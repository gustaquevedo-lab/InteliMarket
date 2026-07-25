"""Supermarket router — production, perishables, waste, forecasting API"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, date
from uuid import UUID

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features import require_feature
from api.src.supermer import service
from api.src.supermer.schemas import (
    RecipeCreate, RecipeUpdate, RecipeResponse,
    ProductionOrderCreate, ProductionOrderUpdate, ProductionOrderResponse,
    ProductionBatchCreate, ProductionBatchResponse,
    WasteLogCreate, WasteLogResponse,
    PerishableConfigCreate, PerishableConfigResponse,
    MarkdownLogCreate, MarkdownLogResponse,
    PurchaseForecastResponse, PurchaseSuggestionCreate, PurchaseSuggestionUpdate,
    PurchaseSuggestionResponse,
    DashboardStats, WasteByArea, ProductionByArea,
    ButcheryTemplateCreate, ButcheryTemplateResponse,
    DesposteInput, DesposteResponse, ButcheryYieldReport,
    BakeryPlanCreate, BakeryPlanResponse,
    ScaleRecipeInput, ScaleRecipeResult,
    ExecutePlanInput, ExecutePlanResult,
    ReceiveBatchCreate, ReceiveBatchResponse,
    FreshnessAuditCreate, FreshnessAuditResponse,
    SupplierScorecardResponse,
    AutoApplyMarkdownByBatchInput, AutoApplyMarkdownResult,
    ForecastEnhanceInput,
)

from . import (
    service_rotiseria,
    service_haccp,
    service_audits,
    service_equipment,
    service_dsd,
    service_inventory,
    service_replenishment,
    service_returns,
    service_pricing,
    service_esl,
    service_promos,
    service_markdown,
)
from .schemas_fase1 import (
    RotiseriaRecipeCreate, RotiseriaRecipeUpdate, RotiseriaRecipeResponse,
    RotiseriaPlanCreate, RotiseriaPlanUpdate,
    RotiseriaTemperatureLogCreate, RotiseriaTemperatureLogResponse,
    RotiseriaLabelCreate, RotiseriaLabelResponse,
    RotiseriaDashboard,
    HaccpPlanCreate, HaccpPlanUpdate, HaccpPlanResponse,
    HaccpCriticalPointCreate, HaccpCriticalPointUpdate, HaccpCriticalPointResponse,
    HaccpMonitoringLogCreate, HaccpMonitoringLogResponse,
    HaccpCorrectiveActionCreate, HaccpCorrectiveActionResponse,
    HaccpComplianceReport, HaccpDashboard,
    AuditTemplateCreate, AuditTemplateUpdate, AuditTemplateResponse,
    AuditTemplateItemCreate, AuditTemplateItemResponse,
    AuditExecutionCreate, AuditExecutionResponse,
    AuditAnswerCreate, AuditAnswerResponse,
    AuditDashboard,
    EquipmentCreate, EquipmentUpdate, EquipmentResponse,
    EquipmentScheduleCreate, EquipmentScheduleUpdate, EquipmentScheduleResponse,
    WorkOrderCreate, WorkOrderUpdate, WorkOrderComplete, WorkOrderResponse,
    EquipmentAlertResponse, EquipmentDashboard,
    AutoMarkdownRotiseriaInput,
)
from .schemas_fase2 import (
    DsdScheduleCreate, DsdScheduleUpdate, DsdScheduleResponse,
    DsdReceivingCreate, DsdReceivingUpdate, DsdReceivingResponse,
    DsdReceivingItemCreate, DsdReceivingItemResponse,
    DsdRejectionCreate, DsdRejectionResponse,
    DsdDashboard,
    CountSessionCreate, CountSessionUpdate, CountSessionResponse,
    CountItemCreate, CountItemUpdate, CountItemResponse,
    AdjustmentCreate, AdjustmentResponse,
    CountSessionDashboard,
    ReplenishmentRuleCreate, ReplenishmentRuleUpdate, ReplenishmentRuleResponse,
    ReplenishmentSuggestionResponse, SuggestionReview, ReplenishmentGenerateInput,
    CrossDockOrderCreate, CrossDockOrderResponse,
    ReplenishmentDashboard,
    SupplierReturnCreate, SupplierReturnUpdate, SupplierReturnResponse,
    ReturnItemCreate, ReturnItemResponse,
    ReturnAuthCreate, ReturnAuthResponse,
    BackhaulCreate, BackhaulUpdate, BackhaulResponse,
    ReturnsDashboard,
)
from .schemas_fase3 import (
    PriceZoneCreate, PriceZoneUpdate, PriceZoneResponse,
    CompetitorPriceCreate, CompetitorPriceResponse,
    PriceAuditLogCreate, PriceAuditLogResponse,
    PsychologicalRuleCreate, PsychologicalRuleResponse,
    EslZoneCreate, EslZoneResponse,
    EslDeviceCreate, EslDeviceUpdate, EslDeviceResponse,
    EslSyncCreate, EslSyncResponse, EslDashboard,
    PromoCalendarCreate, PromoCalendarUpdate, PromoCalendarResponse,
    PromoBudgetCreate, PromoBudgetResponse,
    PromoEffectivenessCreate, PromoEffectivenessResponse,
    PromoDashboard,
    DynamicMarkdownRuleCreate, DynamicMarkdownRuleUpdate, DynamicMarkdownRuleResponse,
    MarkdownRecommendationResponse, MarkdownApplyInput, MarkdownGenerateInput,
    MarkdownDashboard,
)

router = APIRouter(
    prefix="/api/v1/supermer",
    tags=["supermer"],
    dependencies=[Depends(require_feature("supermercado"))],
)


# ============================================================
# DASHBOARD
# ============================================================

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])


@router.get("/production-by-area", response_model=list[ProductionByArea])
async def get_production_by_area(
    desde: Optional[datetime] = Query(None),
    hasta: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_production_by_area(db, user["company_id"], desde, hasta)


# ============================================================
# RECIPES (BOM)
# ============================================================

@router.get("/recipes", response_model=list[RecipeResponse])
async def list_recipes(
    area: Optional[str] = Query(None),
    activa: Optional[bool] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_recipes(db, user["company_id"], area, activa, limit, offset)


@router.get("/recipes/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_recipe(db, recipe_id)
    if not result:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return result


@router.post("/recipes", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    data: RecipeCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_recipe(db, user["company_id"], data)


@router.put("/recipes/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: str,
    data: RecipeUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_recipe(db, recipe_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return result


@router.delete("/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_recipe(db, recipe_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Receta no encontrada")


# ============================================================
# PRODUCTION ORDERS
# ============================================================

@router.get("/orders", response_model=list[ProductionOrderResponse])
async def list_orders(
    area: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    desde: Optional[datetime] = Query(None),
    hasta: Optional[datetime] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_orders(db, user["company_id"], area, estado, desde, hasta, limit, offset)


@router.get("/orders/{order_id}", response_model=ProductionOrderResponse)
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_order(db, order_id)
    if not result:
        raise HTTPException(status_code=404, detail="Orden de producción no encontrada")
    return result


@router.post("/orders", response_model=ProductionOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: ProductionOrderCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.create_order(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/orders/{order_id}", response_model=ProductionOrderResponse)
async def update_order(
    order_id: str,
    data: ProductionOrderUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_order(db, order_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Orden de producción no encontrada")
    return result


class CompleteOrderInput(BaseModel):
    producto_obtenido: float
    costo_unitario: Optional[float] = None
    fecha_vencimiento: Optional[date] = None
    lote_codigo: Optional[str] = None


@router.post("/orders/{order_id}/complete", response_model=ProductionOrderResponse)
async def complete_order(
    order_id: str,
    data: CompleteOrderInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.complete_order(
        db, order_id, data.producto_obtenido,
        costo_unitario=data.costo_unitario,
        fecha_vencimiento=data.fecha_vencimiento,
        lote_codigo=data.lote_codigo,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Orden de producción no encontrada")
    return result


# ============================================================
# WASTE LOGS
# ============================================================

@router.get("/waste", response_model=list[WasteLogResponse])
async def list_waste(
    area: Optional[str] = Query(None),
    tipo_merma: Optional[str] = Query(None),
    desde: Optional[datetime] = Query(None),
    hasta: Optional[datetime] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_waste(db, user["company_id"], area, tipo_merma, desde, hasta, limit, offset)


@router.get("/waste/by-area", response_model=list[WasteByArea])
async def get_waste_by_area(
    desde: Optional[datetime] = Query(None),
    hasta: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_waste_by_area(db, user["company_id"], desde, hasta)


@router.post("/waste", response_model=WasteLogResponse, status_code=status.HTTP_201_CREATED)
async def create_waste(
    data: WasteLogCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_waste(db, user["company_id"], data, user["user_id"])


# ============================================================
# PERISHABLE CONFIG
# ============================================================

@router.get("/perishable-configs", response_model=list[PerishableConfigResponse])
async def list_perishable_configs(
    categoria: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_perishable_configs(db, user["company_id"], categoria)


@router.put("/perishable-configs", response_model=PerishableConfigResponse)
async def upsert_perishable_config(
    data: PerishableConfigCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.upsert_perishable_config(db, user["company_id"], data)


# ============================================================
# MARKDOWNS
# ============================================================

@router.get("/markdowns", response_model=list[MarkdownLogResponse])
async def list_active_markdowns(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_active_markdowns(db, user["company_id"])


@router.post("/markdowns", response_model=MarkdownLogResponse, status_code=status.HTTP_201_CREATED)
async def create_markdown(
    data: MarkdownLogCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_markdown(db, user["company_id"], data, user["user_id"])


@router.post("/markdowns/{markdown_id}/deactivate", response_model=dict)
async def deactivate_markdown(
    markdown_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.deactivate_markdown(db, markdown_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Markdown no encontrado")
    return {"detail": "Markdown desactivado"}


@router.post("/auto-markdowns", response_model=dict)
async def auto_apply_markdowns(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    applied = await service.auto_apply_markdowns(db, user["company_id"])
    return {"detail": f"{applied} markdowns aplicados automáticamente"}


# ============================================================
# FORECASTING
# ============================================================

@router.get("/forecasts", response_model=list[PurchaseForecastResponse])
async def get_forecasts(
    producto_id: Optional[str] = Query(None),
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_forecasts(db, user["company_id"], producto_id, desde, hasta, limit)


@router.post("/forecasts/generate", response_model=dict)
async def generate_forecast(
    lookback_days: int = Query(90, ge=30, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    generated = await service.generate_forecast(db, user["company_id"], lookback_days)
    return {"detail": f"Pronóstico generado para {generated} productos"}


# ============================================================
# PURCHASE SUGGESTIONS
# ============================================================

@router.get("/suggestions", response_model=list[PurchaseSuggestionResponse])
async def list_suggestions(
    estado: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_suggestions(db, user["company_id"], estado, limit, offset)


@router.post("/suggestions/generate", response_model=dict)
async def generate_suggestions(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    generated = await service.generate_suggestions(db, user["company_id"])
    return {"detail": f"{generated} sugerencias de compra generadas"}


@router.put("/suggestions/{suggestion_id}", response_model=PurchaseSuggestionResponse)
async def update_suggestion(
    suggestion_id: str,
    data: PurchaseSuggestionUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_suggestion(db, suggestion_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Sugerencia no encontrada")
    return result


# ============================================================
# BATCHES
# ============================================================

@router.get("/batches", response_model=list[ProductionBatchResponse])
async def list_batches(
    producto_id: Optional[str] = Query(None),
    vencimiento_antes: Optional[date] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from sqlalchemy import select
    from api.src.supermer.models import ProductionBatch

    q = select(ProductionBatch).where(ProductionBatch.company_id == user["company_id"])
    if producto_id:
        q = q.where(ProductionBatch.producto_id == producto_id)
    if vencimiento_antes:
        q = q.where(ProductionBatch.fecha_vencimiento <= vencimiento_antes)
    q = q.order_by(ProductionBatch.fecha_vencimiento).limit(limit).offset(offset)
    r = await db.execute(q)
    batches = r.scalars().all()
    result = []
    for b in batches:
        prod_nombre = await service._get_product_name(db, b.producto_id)
        result.append({
            **{col.name: getattr(b, col.name) for col in b.__table__.columns},
            "producto_nombre": prod_nombre,
        })
    return result


# ============================================================
# BUTCHERY — CARNICERÍA (desposte multi-output)
# ============================================================

@router.get("/butchery/templates", response_model=list[ButcheryTemplateResponse])
async def list_butchery_templates(
    activa: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_butchery_templates(db, user["company_id"], activa)


@router.get("/butchery/templates/{template_id}", response_model=ButcheryTemplateResponse)
async def get_butchery_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_butchery_template(db, template_id)
    if not result:
        raise HTTPException(status_code=404, detail="Plantilla de desposte no encontrada")
    return result


@router.post("/butchery/templates", response_model=ButcheryTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_butchery_template(
    data: ButcheryTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_butchery_template(db, user["company_id"], data)


@router.post("/butchery/desposte", response_model=DesposteResponse)
async def execute_desposte(
    data: DesposteInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.execute_desposte(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/butchery/orders", response_model=list[ProductionOrderResponse])
async def list_butchery_orders(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_butchery_orders(db, user["company_id"], limit, offset)


@router.get("/butchery/yield-report", response_model=list[dict])
async def butchery_yield_report(
    desde: Optional[datetime] = Query(None),
    hasta: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_butchery_yield_report(db, user["company_id"], desde, hasta)


# ============================================================
# BAKERY — PLAN DIARIO + RECETAS ESCALABLES
# ============================================================

@router.get("/bakery/plans", response_model=list[BakeryPlanResponse])
async def list_bakery_plans(
    dia_semana: Optional[int] = Query(None, ge=0, le=7),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_bakery_plans(db, user["company_id"], dia_semana)


@router.get("/bakery/plans/{plan_id}", response_model=BakeryPlanResponse)
async def get_bakery_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_bakery_plan(db, plan_id)
    if not result:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    return result


@router.post("/bakery/plans", response_model=BakeryPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_bakery_plan(
    data: BakeryPlanCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_bakery_plan(db, user["company_id"], data)


@router.delete("/bakery/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bakery_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_bakery_plan(db, plan_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Plan no encontrado")


@router.post("/bakery/scale-recipe", response_model=ScaleRecipeResult)
async def scale_recipe(
    data: ScaleRecipeInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.scale_recipe(db, user["company_id"], data.receta_id, data.cantidad_deseada)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bakery/execute-plan", response_model=ExecutePlanResult)
async def execute_bakery_plan(
    data: ExecutePlanInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.execute_bakery_plan(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# VERDULERÍA — RECEPCIÓN CON CALIDAD
# ============================================================

@router.get("/produce/receive", response_model=list[dict])
async def list_receive_batches(
    producto_id: Optional[str] = Query(None),
    proveedor_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_receive_batches(db, user["company_id"], producto_id, proveedor_id, limit, offset)


@router.get("/produce/receive/{batch_id}", response_model=dict)
async def get_receive_batch(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_receive_batch(db, batch_id)
    if not result:
        raise HTTPException(status_code=404, detail="Batch no encontrado")
    return result


@router.post("/produce/receive", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_receive_batch(
    data: ReceiveBatchCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_receive_batch(db, user["company_id"], data, user.get("id"))


# ============================================================
# FRESHNESS AUDIT (AUDITORÍA DIARIA)
# ============================================================

@router.get("/produce/freshness", response_model=list[dict])
async def list_freshness_audits(
    producto_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_freshness_audits(db, user["company_id"], producto_id, limit, offset)


@router.post("/produce/freshness", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_freshness_audit(
    data: FreshnessAuditCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.create_freshness_audit(db, user["company_id"], data, user.get("id"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# SUPPLIER SCORECARD
# ============================================================

@router.get("/produce/scorecards", response_model=list[dict])
async def list_scorecards(
    proveedor_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_supplier_scorecards(db, user["company_id"], proveedor_id, limit, offset)


@router.post("/produce/scorecards/generate", response_model=dict)
async def generate_scorecards(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.generate_supplier_scorecards(db, user["company_id"])


# ============================================================
# MARKDOWN POR LOTE (TRIAGE ROOM)
# ============================================================

@router.post("/produce/markdown-by-batch", response_model=AutoApplyMarkdownResult)
async def auto_markdown_by_batch(
    data: AutoApplyMarkdownByBatchInput = AutoApplyMarkdownByBatchInput(),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.auto_apply_markdown_by_batch(db, user["company_id"], data)


# ============================================================
# FORECAST ENHANCED
# ============================================================

@router.post("/produce/enhanced-forecast", response_model=dict)
async def enhanced_forecast(
    data: ForecastEnhanceInput = ForecastEnhanceInput(),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.generate_enhanced_forecast(db, user["company_id"], data)


# ============================================================
# PRODUCE DASHBOARD
# ============================================================

@router.get("/produce/dashboard", response_model=dict)
async def produce_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_produce_dashboard(db, user["company_id"])


# ============================================================
# FASE 1 — ROTISERÍA
# ============================================================

@router.get("/rotiseria/recipes", response_model=list[RotiseriaRecipeResponse])
async def rotiseria_list_recipes(
    activa: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.list_recipes(user["company_id"], db, activa)


@router.get("/rotiseria/recipes/{recipe_id}", response_model=RotiseriaRecipeResponse)
async def rotiseria_get_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.get_recipe(recipe_id, db)


@router.post("/rotiseria/recipes", response_model=RotiseriaRecipeResponse, status_code=status.HTTP_201_CREATED)
async def rotiseria_create_recipe(
    data: RotiseriaRecipeCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.create_recipe(user["company_id"], data, db)


@router.put("/rotiseria/recipes/{recipe_id}", response_model=RotiseriaRecipeResponse)
async def rotiseria_update_recipe(
    recipe_id: UUID,
    data: RotiseriaRecipeUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.update_recipe(recipe_id, data, db)


@router.delete("/rotiseria/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def rotiseria_delete_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    await service_rotiseria.delete_recipe(recipe_id, db)


@router.get("/rotiseria/plans", response_model=list)
async def rotiseria_list_plans(
    fecha: Optional[date] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.list_plans(user["company_id"], db, fecha, estado)


@router.get("/rotiseria/plans/{plan_id}", response_model=dict)
async def rotiseria_get_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.get_plan(plan_id, db)


@router.post("/rotiseria/plans", response_model=dict, status_code=status.HTTP_201_CREATED)
async def rotiseria_create_plan(
    data: RotiseriaPlanCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.create_plan(user["company_id"], data, db)


@router.put("/rotiseria/plans/{plan_id}", response_model=dict)
async def rotiseria_update_plan(
    plan_id: UUID,
    data: RotiseriaPlanUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.update_plan(plan_id, data, db)


@router.post("/rotiseria/plans/{plan_id}/complete", response_model=dict)
async def rotiseria_complete_plan(
    plan_id: UUID,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.complete_plan(plan_id, data, db)


@router.post("/rotiseria/plans/{plan_id}/temp-log", response_model=RotiseriaTemperatureLogResponse)
async def rotiseria_add_temp_log(
    plan_id: UUID,
    data: RotiseriaTemperatureLogCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.add_temp_log(plan_id, user["user_id"], data, db)


@router.get("/rotiseria/plans/{plan_id}/temp-logs", response_model=list[RotiseriaTemperatureLogResponse])
async def rotiseria_list_temp_logs(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.list_temp_logs(plan_id, db)


@router.post("/rotiseria/plans/{plan_id}/labels", response_model=list[RotiseriaLabelResponse], status_code=status.HTTP_201_CREATED)
async def rotiseria_generate_labels(
    plan_id: UUID,
    data: list[RotiseriaLabelCreate],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.generate_labels(plan_id, user["company_id"], {"labels": [l.model_dump() for l in data]}, db)


@router.get("/rotiseria/plans/{plan_id}/labels", response_model=list[RotiseriaLabelResponse])
async def rotiseria_list_labels(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.list_labels(plan_id, db)


@router.post("/rotiseria/auto-markdown", response_model=list)
async def rotiseria_auto_markdown(
    data: AutoMarkdownRotiseriaInput = AutoMarkdownRotiseriaInput(),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.suggest_markdowns(user["company_id"], data.model_dump(exclude_none=True), db)


@router.get("/rotiseria/dashboard", response_model=RotiseriaDashboard)
async def rotiseria_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_rotiseria.rotiseria_dashboard(user["company_id"], db)


# ============================================================
# FASE 1 — HACCP (PCC)
# ============================================================

@router.get("/haccp/plans", response_model=list[HaccpPlanResponse])
async def haccp_list_plans(
    activo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.list_haccp_plans(user["company_id"], db, activo)


@router.get("/haccp/plans/{plan_id}", response_model=HaccpPlanResponse)
async def haccp_get_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.get_haccp_plan(plan_id, db)


@router.post("/haccp/plans", response_model=HaccpPlanResponse, status_code=status.HTTP_201_CREATED)
async def haccp_create_plan(
    data: HaccpPlanCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.create_haccp_plan(user["company_id"], data, db)


@router.put("/haccp/plans/{plan_id}", response_model=HaccpPlanResponse)
async def haccp_update_plan(
    plan_id: UUID,
    data: HaccpPlanUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.update_haccp_plan(plan_id, data, db)


@router.get("/haccp/plans/{plan_id}/critical-points", response_model=list[HaccpCriticalPointResponse])
async def haccp_list_critical_points(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.list_critical_points(plan_id, db)


@router.post("/haccp/plans/{plan_id}/critical-points", response_model=HaccpCriticalPointResponse, status_code=status.HTTP_201_CREATED)
async def haccp_create_critical_point(
    plan_id: UUID,
    data: HaccpCriticalPointCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.create_critical_point(plan_id, data, db)


@router.put("/haccp/critical-points/{cp_id}", response_model=HaccpCriticalPointResponse)
async def haccp_update_critical_point(
    cp_id: UUID,
    data: HaccpCriticalPointUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.update_critical_point(cp_id, data, db)


@router.delete("/haccp/critical-points/{cp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def haccp_delete_critical_point(
    cp_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    await service_haccp.delete_critical_point(cp_id, db)


@router.get("/haccp/critical-points/{cp_id}/logs", response_model=list[HaccpMonitoringLogResponse])
async def haccp_list_monitoring_logs(
    cp_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.list_monitoring_logs(cp_id, db)


@router.post("/haccp/critical-points/{cp_id}/logs", response_model=HaccpMonitoringLogResponse, status_code=status.HTTP_201_CREATED)
async def haccp_create_monitoring_log(
    cp_id: UUID,
    data: HaccpMonitoringLogCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.create_monitoring_log(cp_id, user["user_id"], data, db)


@router.get("/haccp/corrective-actions", response_model=list[HaccpCorrectiveActionResponse])
async def haccp_list_corrective_actions(
    resuelto: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.list_corrective_actions(user["company_id"], db, resuelto)


@router.post("/haccp/corrective-actions", response_model=HaccpCorrectiveActionResponse, status_code=status.HTTP_201_CREATED)
async def haccp_create_corrective_action(
    data: HaccpCorrectiveActionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.create_corrective_action(data, db)


@router.post("/haccp/corrective-actions/{ca_id}/resolve", response_model=HaccpCorrectiveActionResponse)
async def haccp_resolve_corrective_action(
    ca_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.resolve_corrective_action(ca_id, db)


@router.get("/haccp/compliance-report", response_model=HaccpComplianceReport)
async def haccp_compliance_report(
    periodo: str = Query("mes"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.compliance_report(user["company_id"], db, periodo)


@router.get("/haccp/dashboard", response_model=HaccpDashboard)
async def haccp_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_haccp.haccp_dashboard(user["company_id"], db)


# ============================================================
# FASE 1 — AUDITORÍAS DE TIENDA
# ============================================================

@router.get("/audit/templates", response_model=list[AuditTemplateResponse])
async def audit_list_templates(
    area: Optional[str] = Query(None),
    activo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.list_templates(user["company_id"], db, area, activo)


@router.get("/audit/templates/{template_id}", response_model=AuditTemplateResponse)
async def audit_get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.get_template(template_id, db)


@router.post("/audit/templates", response_model=AuditTemplateResponse, status_code=status.HTTP_201_CREATED)
async def audit_create_template(
    data: AuditTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.create_template(user["company_id"], data, db)


@router.put("/audit/templates/{template_id}", response_model=AuditTemplateResponse)
async def audit_update_template(
    template_id: UUID,
    data: AuditTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.update_template(template_id, data, db)


@router.delete("/audit/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def audit_delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    await service_audits.delete_template(template_id, db)


@router.post("/audit/templates/{template_id}/items", response_model=AuditTemplateItemResponse, status_code=status.HTTP_201_CREATED)
async def audit_add_template_item(
    template_id: UUID,
    data: AuditTemplateItemCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.add_template_item(template_id, data, db)


@router.put("/audit/templates/items/{item_id}", response_model=AuditTemplateItemResponse)
async def audit_update_template_item(
    item_id: UUID,
    data: AuditTemplateItemCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.update_template_item(item_id, data, db)


@router.delete("/audit/templates/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def audit_delete_template_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    await service_audits.delete_template_item(item_id, db)


@router.get("/audit/executions", response_model=list[AuditExecutionResponse])
async def audit_list_executions(
    area: Optional[str] = Query(None),
    fecha: Optional[date] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.list_executions(user["company_id"], db, area, fecha, estado)


@router.get("/audit/executions/{execution_id}", response_model=AuditExecutionResponse)
async def audit_get_execution(
    execution_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.get_execution(execution_id, db)


@router.post("/audit/executions", response_model=AuditExecutionResponse, status_code=status.HTTP_201_CREATED)
async def audit_start_execution(
    data: AuditExecutionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.start_execution(user["company_id"], user["user_id"], data, db)


@router.post("/audit/executions/{execution_id}/answers", response_model=AuditExecutionResponse)
async def audit_submit_answers(
    execution_id: UUID,
    data: list[AuditAnswerCreate],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.submit_answers(execution_id, user["user_id"], data, db)


@router.post("/audit/executions/{execution_id}/complete", response_model=AuditExecutionResponse)
async def audit_complete_execution(
    execution_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.complete_execution(execution_id, db)


@router.get("/audit/dashboard", response_model=AuditDashboard)
async def audit_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_audits.audit_dashboard(user["company_id"], db)


# ============================================================
# FASE 1 — MANTENIMIENTO DE EQUIPOS
# ============================================================

@router.get("/equipment", response_model=list[EquipmentResponse])
async def equipment_list(
    categoria: Optional[str] = Query(None),
    activo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.list_equipment(user["company_id"], db, categoria, activo)


@router.get("/equipment/{equipment_id}", response_model=EquipmentResponse)
async def equipment_get(
    equipment_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.get_equipment(equipment_id, db)


@router.post("/equipment", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
async def equipment_create(
    data: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.create_equipment(user["company_id"], data, db)


@router.put("/equipment/{equipment_id}", response_model=EquipmentResponse)
async def equipment_update(
    equipment_id: UUID,
    data: EquipmentUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.update_equipment(equipment_id, data, db)


@router.delete("/equipment/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def equipment_delete(
    equipment_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    await service_equipment.delete_equipment(equipment_id, db)


@router.get("/equipment/schedules", response_model=list[EquipmentScheduleResponse])
async def equipment_list_schedules(
    equipo_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.list_schedules(user["company_id"], db, equipo_id)


@router.post("/equipment/schedules", response_model=EquipmentScheduleResponse, status_code=status.HTTP_201_CREATED)
async def equipment_create_schedule(
    data: EquipmentScheduleCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.create_schedule(user["company_id"], data, db)


@router.put("/equipment/schedules/{schedule_id}", response_model=EquipmentScheduleResponse)
async def equipment_update_schedule(
    schedule_id: UUID,
    data: EquipmentScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.update_schedule(schedule_id, data, db)


@router.delete("/equipment/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def equipment_delete_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    await service_equipment.delete_schedule(schedule_id, db)


@router.get("/equipment/work-orders", response_model=list[WorkOrderResponse])
async def equipment_list_work_orders(
    estado: Optional[str] = Query(None),
    equipo_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.list_work_orders(user["company_id"], db, estado, equipo_id)


@router.get("/equipment/work-orders/{wo_id}", response_model=WorkOrderResponse)
async def equipment_get_work_order(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.get_work_order(wo_id, db)


@router.post("/equipment/work-orders", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
async def equipment_create_work_order(
    data: WorkOrderCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.create_work_order(user["company_id"], data, db)


@router.put("/equipment/work-orders/{wo_id}", response_model=WorkOrderResponse)
async def equipment_update_work_order(
    wo_id: UUID,
    data: WorkOrderUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.update_work_order(wo_id, data, db)


@router.post("/equipment/work-orders/{wo_id}/start", response_model=WorkOrderResponse)
async def equipment_start_work_order(
    wo_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.start_work_order(wo_id, db)


@router.post("/equipment/work-orders/{wo_id}/complete", response_model=WorkOrderResponse)
async def equipment_complete_work_order(
    wo_id: UUID,
    data: WorkOrderComplete,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.complete_work_order(wo_id, data, db)


@router.get("/equipment/alerts", response_model=list[EquipmentAlertResponse])
async def equipment_list_alerts(
    resuelta: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.list_alerts(user["company_id"], db, resuelta)


@router.post("/equipment/alerts/{alert_id}/resolve", response_model=EquipmentAlertResponse)
async def equipment_resolve_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.resolve_alert(alert_id, db)


@router.post("/equipment/check-alerts", response_model=list)
async def equipment_check_alerts(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.check_equipment_alerts(user["company_id"], db)


@router.get("/equipment/dashboard", response_model=EquipmentDashboard)
async def equipment_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_equipment.equipment_dashboard(user["company_id"], db)


# ============================================================
# FASE 2 — DSD RECEIVING
# ============================================================

@router.get("/dsd/schedules", response_model=list[DsdScheduleResponse])
async def dsd_list_schedules(
    fecha: Optional[date] = Query(None),
    proveedor_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.list_dsd_schedules(user["company_id"], db, fecha, proveedor_id)


@router.post("/dsd/schedules", response_model=DsdScheduleResponse, status_code=201)
async def dsd_create_schedule(
    data: DsdScheduleCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.create_dsd_schedule(user["company_id"], data, db)


@router.get("/dsd/schedules/{schedule_id}", response_model=DsdScheduleResponse)
async def dsd_get_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.get_dsd_schedule(schedule_id, db)


@router.put("/dsd/schedules/{schedule_id}", response_model=DsdScheduleResponse)
async def dsd_update_schedule(
    schedule_id: UUID,
    data: DsdScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.update_dsd_schedule(schedule_id, data, db)


@router.get("/dsd/receivings", response_model=list[DsdReceivingResponse])
async def dsd_list_receivings(
    fecha: Optional[date] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.list_dsd_receivings(user["company_id"], db, fecha, estado)


@router.post("/dsd/receivings", response_model=DsdReceivingResponse, status_code=201)
async def dsd_create_receiving(
    data: DsdReceivingCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.create_dsd_receiving(user["company_id"], data, db)


@router.get("/dsd/receivings/{receiving_id}", response_model=DsdReceivingResponse)
async def dsd_get_receiving(
    receiving_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.get_dsd_receiving(receiving_id, db)


@router.put("/dsd/receivings/{receiving_id}", response_model=DsdReceivingResponse)
async def dsd_update_receiving(
    receiving_id: UUID,
    data: DsdReceivingUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.update_dsd_receiving(receiving_id, data, db)


@router.get("/dsd/receivings/{receiving_id}/items", response_model=list[DsdReceivingItemResponse])
async def dsd_list_items(
    receiving_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.list_dsd_items(receiving_id, db)


@router.post("/dsd/receivings/{receiving_id}/items", response_model=DsdReceivingItemResponse, status_code=201)
async def dsd_create_item(
    receiving_id: UUID,
    data: DsdReceivingItemCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.create_dsd_item(receiving_id, data, db)


@router.post("/dsd/receivings/{receiving_id}/items/batch", response_model=list[DsdReceivingItemResponse], status_code=201)
async def dsd_batch_create_items(
    receiving_id: UUID,
    items_data: list[DsdReceivingItemCreate],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.batch_create_dsd_items(receiving_id, items_data, db)


@router.get("/dsd/receivings/{receiving_id}/rejections", response_model=list[DsdRejectionResponse])
async def dsd_list_rejections(
    receiving_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.list_dsd_rejections(receiving_id, db)


@router.post("/dsd/receivings/{receiving_id}/rejections", response_model=DsdRejectionResponse, status_code=201)
async def dsd_create_rejection(
    receiving_id: UUID,
    data: DsdRejectionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.create_dsd_rejection(user["company_id"], receiving_id, data, db)


@router.get("/dsd/dashboard", response_model=DsdDashboard)
async def dsd_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_dsd.get_dsd_dashboard(user["company_id"], db)


# ============================================================
# FASE 2 — PHYSICAL INVENTORY
# ============================================================

@router.get("/inventory/sessions", response_model=list[CountSessionResponse])
async def inventory_list_sessions(
    area: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.list_count_sessions(user["company_id"], db, area, estado)


@router.post("/inventory/sessions", response_model=CountSessionResponse, status_code=201)
async def inventory_create_session(
    data: CountSessionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.create_count_session(user["company_id"], data, db)


@router.get("/inventory/sessions/{session_id}", response_model=CountSessionResponse)
async def inventory_get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.get_count_session(session_id, db)


@router.put("/inventory/sessions/{session_id}", response_model=CountSessionResponse)
async def inventory_update_session(
    session_id: UUID,
    data: CountSessionUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.update_count_session(session_id, data, db)


@router.post("/inventory/sessions/{session_id}/complete", response_model=CountSessionResponse)
async def inventory_complete_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.complete_count_session(session_id, db)


@router.get("/inventory/sessions/{session_id}/items", response_model=list[CountItemResponse])
async def inventory_list_items(
    session_id: UUID,
    requiere_ajuste: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.list_count_items(session_id, requiere_ajuste)


@router.post("/inventory/sessions/{session_id}/items", response_model=CountItemResponse, status_code=201)
async def inventory_create_item(
    session_id: UUID,
    data: CountItemCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.create_count_item(session_id, data, db)


@router.put("/inventory/items/{item_id}", response_model=CountItemResponse)
async def inventory_update_item(
    item_id: UUID,
    data: CountItemUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.update_count_item(item_id, data, db)


@router.post("/inventory/sessions/{session_id}/items/batch", response_model=list[CountItemResponse], status_code=201)
async def inventory_batch_create_items(
    session_id: UUID,
    items_data: list[CountItemCreate],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.batch_create_count_items(session_id, items_data, db)


@router.get("/inventory/sessions/{session_id}/adjustments", response_model=list[AdjustmentResponse])
async def inventory_list_adjustments(
    session_id: UUID,
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.list_adjustments(session_id, estado)


@router.post("/inventory/sessions/{session_id}/adjustments", response_model=AdjustmentResponse, status_code=201)
async def inventory_create_adjustment(
    session_id: UUID,
    data: AdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.create_adjustment(user["company_id"], session_id, data, db)


@router.post("/inventory/adjustments/{adjustment_id}/approve", response_model=AdjustmentResponse)
async def inventory_approve_adjustment(
    adjustment_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.approve_adjustment(adjustment_id, user["user_id"], db)


@router.post("/inventory/adjustments/{adjustment_id}/reject", response_model=AdjustmentResponse)
async def inventory_reject_adjustment(
    adjustment_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.reject_adjustment(adjustment_id, db)


@router.get("/inventory/dashboard", response_model=CountSessionDashboard)
async def inventory_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_inventory.get_inventory_dashboard(user["company_id"], db)


# ============================================================
# FASE 2 — AUTO REPLENISHMENT
# ============================================================

@router.get("/replenishment/rules", response_model=list[ReplenishmentRuleResponse])
async def replenishment_list_rules(
    activa: Optional[bool] = Query(None),
    producto_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.list_replenishment_rules(user["company_id"], db, activa, producto_id)


@router.post("/replenishment/rules", response_model=ReplenishmentRuleResponse, status_code=201)
async def replenishment_create_rule(
    data: ReplenishmentRuleCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.create_replenishment_rule(user["company_id"], data, db)


@router.get("/replenishment/rules/{rule_id}", response_model=ReplenishmentRuleResponse)
async def replenishment_get_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.get_replenishment_rule(rule_id, db)


@router.put("/replenishment/rules/{rule_id}", response_model=ReplenishmentRuleResponse)
async def replenishment_update_rule(
    rule_id: UUID,
    data: ReplenishmentRuleUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.update_replenishment_rule(rule_id, data, db)


@router.post("/replenishment/generate", response_model=list[ReplenishmentSuggestionResponse], status_code=201)
async def replenishment_generate(
    data: ReplenishmentGenerateInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.generate_suggestions(user["company_id"], db, data.proveedor_id, data.solo_criticos)


@router.get("/replenishment/suggestions", response_model=list[ReplenishmentSuggestionResponse])
async def replenishment_list_suggestions(
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.list_suggestions(user["company_id"], db, estado)


@router.post("/replenishment/suggestions/{suggestion_id}/review", response_model=ReplenishmentSuggestionResponse)
async def replenishment_review_suggestion(
    suggestion_id: UUID,
    data: SuggestionReview,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.review_suggestion(suggestion_id, data, db, user["user_id"])


@router.post("/crossdock/orders", response_model=CrossDockOrderResponse, status_code=201)
async def crossdock_create_order(
    data: CrossDockOrderCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.create_crossdock_order(user["company_id"], data, db)


@router.get("/crossdock/orders", response_model=list[CrossDockOrderResponse])
async def crossdock_list_orders(
    fecha: Optional[date] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.list_crossdock_orders(user["company_id"], db, fecha, estado)


@router.post("/crossdock/orders/{order_id}/complete", response_model=CrossDockOrderResponse)
async def crossdock_complete_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.complete_crossdock_order(order_id, db)


@router.get("/replenishment/dashboard", response_model=ReplenishmentDashboard)
async def replenishment_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_replenishment.get_replenishment_dashboard(user["company_id"], db)


# ============================================================
# FASE 2 — SUPPLIER RETURNS & BACKHAUL
# ============================================================

@router.get("/returns", response_model=list[SupplierReturnResponse])
async def returns_list(
    estado: Optional[str] = Query(None),
    proveedor_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.list_returns(user["company_id"], db, estado, proveedor_id)


@router.post("/returns", response_model=SupplierReturnResponse, status_code=201)
async def returns_create(
    data: SupplierReturnCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.create_return(user["company_id"], data, db)


@router.get("/returns/{return_id}", response_model=SupplierReturnResponse)
async def returns_get(
    return_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.get_return(return_id, db)


@router.put("/returns/{return_id}", response_model=SupplierReturnResponse)
async def returns_update(
    return_id: UUID,
    data: SupplierReturnUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.update_return(return_id, data, db)


@router.post("/returns/{return_id}/authorize", response_model=SupplierReturnResponse)
async def returns_authorize(
    return_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.authorize_return(return_id, user["user_id"], db)


@router.post("/returns/{return_id}/complete", response_model=SupplierReturnResponse)
async def returns_complete(
    return_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.complete_return(return_id, user["user_id"], db)


@router.post("/returns/{return_id}/items", response_model=ReturnItemResponse, status_code=201)
async def returns_create_item(
    return_id: UUID,
    data: ReturnItemCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.create_return_item(return_id, data, db)


@router.get("/returns/{return_id}/authorizations", response_model=list[ReturnAuthResponse])
async def returns_list_auths(
    return_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.list_return_authorizations(return_id, db)


@router.post("/returns/{return_id}/authorizations", response_model=ReturnAuthResponse, status_code=201)
async def returns_create_auth(
    return_id: UUID,
    data: ReturnAuthCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.create_return_authorization(return_id, data, db)


@router.get("/backhauls", response_model=list[BackhaulResponse])
async def backhaul_list(
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.list_backhauls(user["company_id"], db, estado)


@router.post("/backhauls", response_model=BackhaulResponse, status_code=201)
async def backhaul_create(
    data: BackhaulCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.create_backhaul(user["company_id"], data, db)


@router.get("/backhauls/{backhaul_id}", response_model=BackhaulResponse)
async def backhaul_get(
    backhaul_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.get_backhaul(backhaul_id, db)


@router.put("/backhauls/{backhaul_id}", response_model=BackhaulResponse)
async def backhaul_update(
    backhaul_id: UUID,
    data: BackhaulUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.update_backhaul(backhaul_id, data, db)


@router.get("/returns/dashboard", response_model=ReturnsDashboard)
async def returns_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_returns.get_returns_dashboard(user["company_id"], db)


# ============================================================
# FASE 3 — PRECIOS MULTICANAL
# ============================================================

@router.get("/price-zones", response_model=list[PriceZoneResponse])
async def pricing_list_zones(
    activa: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.list_price_zones(user["company_id"], db, activa)

@router.post("/price-zones", response_model=PriceZoneResponse, status_code=201)
async def pricing_create_zone(
    data: PriceZoneCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.create_price_zone(user["company_id"], data, db)

@router.put("/price-zones/{zone_id}", response_model=PriceZoneResponse)
async def pricing_update_zone(
    zone_id: UUID,
    data: PriceZoneUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.update_price_zone(zone_id, data, db)

@router.get("/competitor-prices", response_model=list[CompetitorPriceResponse])
async def pricing_list_competitor(
    producto_id: Optional[UUID] = Query(None),
    competidor: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.list_competitor_prices(user["company_id"], db, producto_id, competidor)

@router.post("/competitor-prices", response_model=CompetitorPriceResponse, status_code=201)
async def pricing_create_competitor(
    data: CompetitorPriceCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.create_competitor_price(user["company_id"], data, db)

@router.get("/competitor-prices/{producto_id}/latest", response_model=list[CompetitorPriceResponse])
async def pricing_competitor_latest(
    producto_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.get_competitor_price_latest(user["company_id"], producto_id, db)

@router.get("/price-audit-logs", response_model=list[PriceAuditLogResponse])
async def pricing_list_audit_logs(
    producto_id: Optional[UUID] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.list_price_audit_logs(user["company_id"], db, producto_id, estado)

@router.post("/price-audit-logs", response_model=PriceAuditLogResponse, status_code=201)
async def pricing_create_audit_log(
    data: PriceAuditLogCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.create_price_audit_log(user["company_id"], data, db, user["user_id"])

@router.post("/price-audit-logs/{log_id}/approve", response_model=PriceAuditLogResponse)
async def pricing_approve_change(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.approve_price_change(log_id, user["user_id"], db)

@router.get("/psychological-rules", response_model=list[PsychologicalRuleResponse])
async def pricing_list_psych_rules(
    activa: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.list_psychological_rules(user["company_id"], db, activa)

@router.post("/psychological-rules", response_model=PsychologicalRuleResponse, status_code=201)
async def pricing_create_psych_rule(
    data: PsychologicalRuleCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.create_psychological_rule(user["company_id"], data, db)

@router.post("/psychological-rules/apply/{producto_id}", response_model=dict)
async def pricing_apply_psych(
    producto_id: UUID,
    rule_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.apply_psychological_to_product(producto_id, rule_id, db)

@router.get("/pricing/dashboard", response_model=dict)
async def pricing_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_pricing.get_pricing_dashboard(user["company_id"], db)


# ============================================================
# FASE 3 — ESL (ELECTRONIC SHELF LABELS)
# ============================================================

@router.get("/esl/zones", response_model=list[EslZoneResponse])
async def esl_list_zones(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_esl.list_esl_zones(user["company_id"], db)

@router.post("/esl/zones", response_model=EslZoneResponse, status_code=201)
async def esl_create_zone(
    data: EslZoneCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_esl.create_esl_zone(user["company_id"], data, db)

@router.get("/esl/devices", response_model=list[EslDeviceResponse])
async def esl_list_devices(
    zona_id: Optional[UUID] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_esl.list_esl_devices(user["company_id"], db, zona_id, estado)

@router.post("/esl/devices", response_model=EslDeviceResponse, status_code=201)
async def esl_create_device(
    data: EslDeviceCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_esl.create_esl_device(user["company_id"], data, db)

@router.put("/esl/devices/{device_id}", response_model=EslDeviceResponse)
async def esl_update_device(
    device_id: UUID,
    data: EslDeviceUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_esl.update_esl_device(device_id, data, db)

@router.post("/esl/sync", response_model=EslSyncResponse, status_code=201)
async def esl_sync_price(
    data: EslSyncCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_esl.sync_esl_price(user["company_id"], data, db)

@router.post("/esl/sync/{sync_id}/confirm", response_model=EslSyncResponse)
async def esl_confirm_sync(
    sync_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_esl.confirm_esl_sync(sync_id, db)

@router.get("/esl/syncs", response_model=list[EslSyncResponse])
async def esl_list_syncs(
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_esl.list_esl_syncs(user["company_id"], db, estado)

@router.get("/esl/dashboard", response_model=EslDashboard)
async def esl_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_esl.get_esl_dashboard(user["company_id"], db)


# ============================================================
# FASE 3 — CALENDARIO PROMOCIONAL
# ============================================================

@router.get("/promos", response_model=list[PromoCalendarResponse])
async def promos_list(
    tipo: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_promos.list_promos(user["company_id"], db, tipo, estado, desde, hasta)

@router.post("/promos", response_model=PromoCalendarResponse, status_code=201)
async def promos_create(
    data: PromoCalendarCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_promos.create_promo(user["company_id"], data, db)

@router.put("/promos/{promo_id}", response_model=PromoCalendarResponse)
async def promos_update(
    promo_id: UUID,
    data: PromoCalendarUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_promos.update_promo(promo_id, data, db)

@router.get("/promos/{promo_id}/budgets", response_model=list[PromoBudgetResponse])
async def promos_list_budgets(
    promo_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_promos.list_promo_budgets(promo_id, db)

@router.post("/promos/budgets", response_model=PromoBudgetResponse, status_code=201)
async def promos_create_budget(
    data: PromoBudgetCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_promos.create_promo_budget(data, db)

@router.get("/promos/effectiveness", response_model=list[PromoEffectivenessResponse])
async def promos_list_effectiveness(
    promo_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_promos.list_promo_effectiveness(user["company_id"], db, promo_id)

@router.post("/promos/effectiveness", response_model=PromoEffectivenessResponse, status_code=201)
async def promos_create_effectiveness(
    data: PromoEffectivenessCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_promos.create_promo_effectiveness(user["company_id"], data, db)

@router.get("/promos/dashboard", response_model=PromoDashboard)
async def promos_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_promos.get_promo_dashboard(user["company_id"], db)


# ============================================================
# FASE 3 — MARKDOWN DINÁMICO
# ============================================================

@router.get("/dynamic-markdown/rules", response_model=list[DynamicMarkdownRuleResponse])
async def markdown_list_rules(
    activa: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_markdown.list_markdown_rules(user["company_id"], db, activa)

@router.post("/dynamic-markdown/rules", response_model=DynamicMarkdownRuleResponse, status_code=201)
async def markdown_create_rule(
    data: DynamicMarkdownRuleCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_markdown.create_markdown_rule(user["company_id"], data, db)

@router.put("/dynamic-markdown/rules/{rule_id}", response_model=DynamicMarkdownRuleResponse)
async def markdown_update_rule(
    rule_id: UUID,
    data: DynamicMarkdownRuleUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_markdown.update_markdown_rule(rule_id, data, db)

@router.post("/dynamic-markdown/generate", response_model=list[MarkdownRecommendationResponse], status_code=201)
async def markdown_generate(
    data: MarkdownGenerateInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_markdown.generate_recommendations(user["company_id"], db, data.solo_urgentes, data.max_recommendations)

@router.get("/dynamic-markdown/recommendations", response_model=list[MarkdownRecommendationResponse])
async def markdown_list_recommendations(
    aplicada: Optional[bool] = Query(None),
    solo_urgentes: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_markdown.list_recommendations(user["company_id"], db, aplicada, solo_urgentes)

@router.post("/dynamic-markdown/apply", response_model=list[MarkdownRecommendationResponse])
async def markdown_apply(
    data: MarkdownApplyInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_markdown.apply_recommendations(user["company_id"], data.recommendation_ids, db)

@router.get("/dynamic-markdown/dashboard", response_model=MarkdownDashboard)
async def markdown_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service_markdown.get_markdown_dashboard(user["company_id"], db)
