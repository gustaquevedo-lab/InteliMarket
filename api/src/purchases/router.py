"""Purchases API router — suppliers, orders, receipts, requisitions, contracts, forecasting, suggestions, budgets, reports"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.purchases.schemas import (
    SupplierCreate, SupplierUpdate, SupplierResponse,
    POItemInput, POCreate, POUpdate, POResponse, POWithItems, POItemResponse, POHistoryResponse,
    ReceiptCreate, ReceiptResponse, ReceiptWithItems, ReceiptItemResponse,
    RequisitionCreate, RequisitionUpdate, RequisitionResponse, RequisitionWithItems, RequisitionItemResponse,
    ContractCreate, ContractUpdate, ContractResponse, ContractItemResponse,
    EvaluationCreate, EvaluationResponse, SupplierPerformanceResponse, PriceHistoryResponse,
    ForecastRuleCreate, ForecastRuleUpdate, ForecastRuleResponse, ForecastProjectionResponse,
    PurchaseSuggestionResponse,
    BudgetCreate, BudgetUpdate, BudgetResponse, BudgetConsumptionResponse,
    SpendBySupplierResponse, SpendByCategoryResponse, PriceVarianceResponse, PurchaseKPIsResponse,
)
from api.src.purchases import service

router = APIRouter(prefix="/api/v1", tags=["purchases"])


# ── Suppliers ─────────────────────────────────────────────────────────────────

@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(body: SupplierCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_supplier(db, body)


@router.get("/companies/{company_id}/suppliers", response_model=list[SupplierResponse])
async def list_suppliers(company_id: str, search: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.list_suppliers(db, company_id, search)


@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(supplier_id: str, db: AsyncSession = Depends(get_db)):
    supplier = await service.get_supplier(db, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return supplier


@router.patch("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(supplier_id: str, body: SupplierUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_supplier(db, supplier_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return result


# ── Supplier Intelligence ─────────────────────────────────────────────────────

@router.post("/suppliers/{supplier_id}/evaluate", response_model=EvaluationResponse, status_code=status.HTTP_201_CREATED)
async def evaluate_supplier(supplier_id: str, body: EvaluationCreate, db: AsyncSession = Depends(get_db)):
    body.supplier_id = supplier_id  # type: ignore
    return await service.evaluate_supplier(db, body)


@router.get("/suppliers/{supplier_id}/evaluations", response_model=list[EvaluationResponse])
async def get_supplier_evaluations(supplier_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_supplier_evaluations(db, supplier_id)


@router.get("/suppliers/{supplier_id}/price-history", response_model=list[PriceHistoryResponse])
async def get_supplier_price_history(
    supplier_id: str,
    product_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_supplier_price_history(db, supplier_id, product_id)


@router.get("/suppliers/{supplier_id}/performance", response_model=SupplierPerformanceResponse)
async def get_supplier_performance(supplier_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_supplier_performance(db, supplier_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ── Supplier Contracts ────────────────────────────────────────────────────────

@router.post("/supplier-contracts", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier_contract(body: ContractCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_supplier_contract(db, body)


@router.get("/companies/{company_id}/supplier-contracts", response_model=list[ContractResponse])
async def list_supplier_contracts(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_supplier_contracts(db, company_id)


@router.get("/supplier-contracts/{contract_id}", response_model=ContractResponse)
async def get_supplier_contract(contract_id: str, db: AsyncSession = Depends(get_db)):
    contract = await service.get_supplier_contract(db, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return contract


@router.put("/supplier-contracts/{contract_id}", response_model=ContractResponse)
async def update_supplier_contract(contract_id: str, body: ContractUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_supplier_contract(db, contract_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return result


# ── Purchase Orders ───────────────────────────────────────────────────────────

@router.post("/purchase-orders", response_model=POResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(body: POCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_purchase_order(db, body)


@router.get("/companies/{company_id}/purchase-orders", response_model=list[POResponse])
async def list_purchase_orders(
    company_id: str,
    supplier_id: str | None = Query(None),
    estado: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_purchase_orders(db, company_id, supplier_id, estado)


@router.get("/purchase-orders/{po_id}", response_model=POWithItems)
async def get_purchase_order(po_id: str, db: AsyncSession = Depends(get_db)):
    order = await service.get_purchase_order_with_items(db, po_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada")
    return order


@router.put("/purchase-orders/{po_id}", response_model=POResponse)
async def update_purchase_order(po_id: str, body: POUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_purchase_order(db, po_id, body)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo actualizar. Solo se permite en estado borrador")
    return result


@router.post("/purchase-orders/{po_id}/confirm", response_model=POResponse)
async def confirm_purchase_order(
    po_id: str,
    user_id: str | None = Query(None),
    user_name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await service.confirm_purchase_order(db, po_id, user_id, user_name)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo confirmar. Verifique que tenga items y esté en borrador")
    return result


@router.post("/purchase-orders/{po_id}/send", response_model=POResponse)
async def send_purchase_order(
    po_id: str,
    seguimiento_numero: str | None = Query(None),
    user_id: str | None = Query(None),
    user_name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await service.send_purchase_order(db, po_id, seguimiento_numero, user_id, user_name)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo enviar. La orden debe estar confirmada")
    return result


@router.post("/purchase-orders/{po_id}/cancel", response_model=POResponse)
async def cancel_purchase_order(
    po_id: str,
    motivo: str | None = Query(None),
    user_id: str | None = Query(None),
    user_name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await service.cancel_purchase_order(db, po_id, motivo, user_id, user_name)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo cancelar. Verifique el estado actual")
    return result


@router.get("/purchase-orders/{po_id}/items", response_model=list[POItemResponse])
async def get_po_items(po_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_po_items(db, po_id)


@router.get("/purchase-orders/{po_id}/history", response_model=list[POHistoryResponse])
async def get_po_history(po_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_po_history(db, po_id)


# ── Purchase Requisitions ─────────────────────────────────────────────────────

@router.post("/purchase-requisitions", response_model=RequisitionResponse, status_code=status.HTTP_201_CREATED)
async def create_requisition(body: RequisitionCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_requisition(db, body)


@router.get("/companies/{company_id}/purchase-requisitions", response_model=list[RequisitionResponse])
async def list_requisitions(
    company_id: str,
    estado: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_requisitions(db, company_id, estado)


@router.get("/purchase-requisitions/{req_id}", response_model=RequisitionWithItems)
async def get_requisition(req_id: str, db: AsyncSession = Depends(get_db)):
    req = await service.get_requisition(db, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requisición no encontrada")
    return req


@router.put("/purchase-requisitions/{req_id}", response_model=RequisitionResponse)
async def update_requisition(req_id: str, body: RequisitionUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_requisition(db, req_id, body)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo actualizar. Solo se permite en estado borrador")
    return result


@router.post("/purchase-requisitions/{req_id}/approve", response_model=RequisitionResponse)
async def approve_requisition(
    req_id: str,
    aprobado_por: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await service.approve_requisition(db, req_id, aprobado_por)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar. Verifique el estado actual")
    return result


@router.post("/purchase-requisitions/{req_id}/reject", response_model=RequisitionResponse)
async def reject_requisition(
    req_id: str,
    motivo: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await service.reject_requisition(db, req_id, motivo)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo rechazar. Verifique el estado actual")
    return result


@router.post("/purchase-requisitions/{req_id}/convert", response_model=POResponse, status_code=status.HTTP_201_CREATED)
async def convert_requisition_to_po(
    req_id: str,
    supplier_id: str | None = Query(None),
    user_id: str | None = Query(None),
    user_name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await service.convert_requisition_to_po(db, req_id, user_id, user_name, supplier_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo convertir. La requisición debe estar aprobada y tener un proveedor asignado")
    return result


# ── Purchase Receipts ─────────────────────────────────────────────────────────

@router.post("/purchase-receipts", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(body: ReceiptCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_receipt(db, body)


@router.get("/companies/{company_id}/purchase-receipts", response_model=list[ReceiptResponse])
async def list_receipts(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_receipts(db, company_id)


@router.get("/purchase-receipts/{receipt_id}", response_model=ReceiptWithItems)
async def get_receipt(receipt_id: str, db: AsyncSession = Depends(get_db)):
    receipt = await service.get_receipt(db, receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Recepción no encontrada")
    items = await service.get_receipt_items(db, receipt_id)
    receipt.items = items
    return receipt


@router.get("/purchase-receipts/{receipt_id}/items", response_model=list[ReceiptItemResponse])
async def get_receipt_items(receipt_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_receipt_items(db, receipt_id)


# ── Forecasting ───────────────────────────────────────────────────────────────

@router.post("/forecast-rules", response_model=ForecastRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_forecast_rule(body: ForecastRuleCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_forecast_rule(db, body)


@router.get("/companies/{company_id}/forecast-rules", response_model=list[ForecastRuleResponse])
async def list_forecast_rules(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_forecast_rules(db, company_id)


@router.put("/forecast-rules/{rule_id}", response_model=ForecastRuleResponse)
async def update_forecast_rule(rule_id: str, body: ForecastRuleUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_forecast_rule(db, rule_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Regla de forecast no encontrada")
    return result


@router.delete("/forecast-rules/{rule_id}")
async def delete_forecast_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_forecast_rule(db, rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Regla de forecast no encontrada")
    return {"message": "Regla eliminada"}


@router.post("/forecast-rules/{rule_id}/run")
async def run_forecast(rule_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.run_forecast(db, rule_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Purchase Suggestions ──────────────────────────────────────────────────────

@router.get("/companies/{company_id}/purchase-suggestions", response_model=list[PurchaseSuggestionResponse])
async def list_suggestions(
    company_id: str,
    estado: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_suggestions(db, company_id, estado)


@router.post("/purchase-suggestions/generate")
async def generate_suggestions(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.generate_purchase_suggestions(db, company_id)


@router.post("/purchase-suggestions/{suggestion_id}/apply", response_model=POResponse, status_code=status.HTTP_201_CREATED)
async def apply_suggestion(
    suggestion_id: str,
    user_id: str | None = Query(None),
    user_name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await service.apply_suggestion(db, suggestion_id, user_id, user_name)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aplicar la sugerencia")
    return result


@router.post("/purchase-suggestions/{suggestion_id}/dismiss", response_model=PurchaseSuggestionResponse)
async def dismiss_suggestion(suggestion_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.dismiss_suggestion(db, suggestion_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo descartar la sugerencia")
    return result


# ── Purchase Budgets ──────────────────────────────────────────────────────────

@router.post("/purchase-budgets", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(body: BudgetCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_budget(db, body)


@router.get("/companies/{company_id}/purchase-budgets", response_model=list[BudgetResponse])
async def list_budgets(
    company_id: str,
    anio: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_budgets(db, company_id, anio)


@router.get("/purchase-budgets/{budget_id}", response_model=BudgetResponse)
async def get_budget(budget_id: str, db: AsyncSession = Depends(get_db)):
    budget = await service.get_budget(db, budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return budget


@router.put("/purchase-budgets/{budget_id}", response_model=BudgetResponse)
async def update_budget(budget_id: str, body: BudgetUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_budget(db, budget_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return result


@router.get("/companies/{company_id}/purchase-budgets/consumption", response_model=list[BudgetConsumptionResponse])
async def get_budget_consumption(
    company_id: str,
    anio: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_budget_consumption(db, company_id, anio)


# ── Purchase Reports ──────────────────────────────────────────────────────────

@router.get("/companies/{company_id}/purchase-reports/spend-by-supplier", response_model=list[SpendBySupplierResponse])
async def spend_by_supplier(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_spend_by_supplier(db, company_id)


@router.get("/companies/{company_id}/purchase-reports/spend-by-category", response_model=list[SpendByCategoryResponse])
async def spend_by_category(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_spend_by_category(db, company_id)


@router.get("/companies/{company_id}/purchase-reports/price-variance", response_model=list[PriceVarianceResponse])
async def price_variance(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_price_variance(db, company_id)


@router.get("/companies/{company_id}/purchase-reports/kpis", response_model=PurchaseKPIsResponse)
async def purchase_kpis(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_purchase_kpis(db, company_id)
