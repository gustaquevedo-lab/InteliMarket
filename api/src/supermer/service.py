"""Supermarket service — production, perishables, waste, forecasting"""

from typing import Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, delete, func as sa_func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from api.src.supermer.models import (
    ProductionRecipe, ProductionRecipeItem, ProductionOrder, ProductionBatch,
    WasteLog, PerishableConfig, MarkdownLog, PurchaseForecast, PurchaseSuggestion,
    ButcheryTemplate, ButcheryTemplateCut,
    BakeryDailyPlan, BakeryPlanItem,
    ReceiveBatch, FreshnessAudit, SupplierScorecard,
    ProductionOrderStatus, WasteType, ForecastStatus,
    ReceiveQualityGrade, FreshnessGrade,
)
from api.src.supermer.schemas import (
    RecipeCreate, RecipeUpdate, ProductionOrderCreate, ProductionOrderUpdate,
    ProductionBatchCreate, WasteLogCreate, PerishableConfigCreate,
    MarkdownLogCreate, PurchaseSuggestionCreate, PurchaseSuggestionUpdate,
    ReceiveBatchCreate, FreshnessAuditCreate, ForecastEnhanceInput,
)
from api.src.products.models import Product


# ============================================================
# HELPERS
# ============================================================

async def _get_product_name(db: AsyncSession, product_id: UUID) -> Optional[str]:
    r = await db.execute(select(Product.nombre).where(Product.id == product_id))
    row = r.scalar_one_or_none()
    return str(row) if row else None


async def _get_user_name(db: AsyncSession, user_id: UUID) -> Optional[str]:
    from api.src.users.models import User
    r = await db.execute(select(User.nombre).where(User.id == user_id))
    row = r.scalar_one_or_none()
    return str(row) if row else None


async def _get_supplier_name(db: AsyncSession, supplier_id: UUID) -> Optional[str]:
    from api.src.suppliers.models import Supplier
    r = await db.execute(select(Supplier.nombre).where(Supplier.id == supplier_id))
    row = r.scalar_one_or_none()
    return str(row) if row else None


# ============================================================
# RECIPES (BOM)
# ============================================================

async def list_recipes(
    db: AsyncSession, company_id: str, area: Optional[str] = None,
    activa: Optional[bool] = None, limit: int = 100, offset: int = 0,
) -> list[dict]:
    q = select(ProductionRecipe).where(ProductionRecipe.company_id == company_id)
    if area:
        q = q.where(ProductionRecipe.area == area)
    if activa is not None:
        q = q.where(ProductionRecipe.activa == activa)
    q = q.order_by(ProductionRecipe.nombre).limit(limit).offset(offset)
    r = await db.execute(q)
    recipes = r.scalars().all()

    result = []
    for rec in recipes:
        items_q = select(ProductionRecipeItem).where(ProductionRecipeItem.receta_id == rec.id)
        items_r = await db.execute(items_q)
        items = items_r.scalars().all()
        prod_nombre = await _get_product_name(db, rec.producto_terminado_id)
        result.append({
            **{c.name: getattr(rec, c.name) for c in rec.__table__.columns},
            "items": [
                {
                    **{c.name: getattr(it, c.name) for c in it.__table__.columns},
                    "producto_nombre": await _get_product_name(db, it.producto_id),
                }
                for it in items
            ],
            "producto_terminado_nombre": prod_nombre,
        })
    return result


async def get_recipe(db: AsyncSession, recipe_id: str) -> Optional[dict]:
    r = await db.execute(select(ProductionRecipe).where(ProductionRecipe.id == recipe_id))
    rec = r.scalar_one_or_none()
    if not rec:
        return None
    items_q = select(ProductionRecipeItem).where(ProductionRecipeItem.receta_id == rec.id)
    items_r = await db.execute(items_q)
    items = items_r.scalars().all()
    prod_nombre = await _get_product_name(db, rec.producto_terminado_id)
    return {
        **{c.name: getattr(rec, c.name) for c in rec.__table__.columns},
        "items": [
            {
                **{c.name: getattr(it, c.name) for c in it.__table__.columns},
                "producto_nombre": await _get_product_name(db, it.producto_id),
            }
            for it in items
        ],
        "producto_terminado_nombre": prod_nombre,
    }


async def create_recipe(db: AsyncSession, company_id: str, data: RecipeCreate) -> dict:
    rec = ProductionRecipe(
        company_id=company_id,
        area=data.area,
        nombre=data.nombre,
        descripcion=data.descripcion,
        producto_terminado_id=data.producto_terminado_id,
        cantidad_esperada=data.cantidad_esperada,
        unidad_medida=data.unidad_medida,
        rendimiento_esperado=data.rendimiento_esperado,
    )
    db.add(rec)
    await db.flush()
    for item in data.items:
        ri = ProductionRecipeItem(
            receta_id=rec.id,
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            unidad_medida=item.unidad_medida,
            es_opcional=item.es_opcional,
        )
        db.add(ri)
    await db.commit()
    return await get_recipe(db, str(rec.id))


async def update_recipe(db: AsyncSession, recipe_id: str, data: RecipeUpdate) -> Optional[dict]:
    r = await db.execute(select(ProductionRecipe).where(ProductionRecipe.id == recipe_id))
    rec = r.scalar_one_or_none()
    if not rec:
        return None
    update_data = data.model_dump(exclude_unset=True, exclude={"items"})
    for key, val in update_data.items():
        setattr(rec, key, val)
    if data.items is not None:
        await db.execute(delete(ProductionRecipeItem).where(ProductionRecipeItem.receta_id == rec.id))
        for item in data.items:
            ri = ProductionRecipeItem(
                receta_id=rec.id,
                producto_id=item.producto_id,
                cantidad=item.cantidad,
                unidad_medida=item.unidad_medida,
                es_opcional=item.es_opcional,
            )
            db.add(ri)
    await db.commit()
    return await get_recipe(db, recipe_id)


async def delete_recipe(db: AsyncSession, recipe_id: str) -> bool:
    r = await db.execute(select(ProductionRecipe).where(ProductionRecipe.id == recipe_id))
    rec = r.scalar_one_or_none()
    if not rec:
        return False
    await db.execute(delete(ProductionRecipeItem).where(ProductionRecipeItem.receta_id == rec.id))
    await db.delete(rec)
    await db.commit()
    return True


# ============================================================
# PRODUCTION ORDERS
# ============================================================

async def list_orders(
    db: AsyncSession, company_id: str, area: Optional[str] = None,
    estado: Optional[str] = None, desde: Optional[datetime] = None,
    hasta: Optional[datetime] = None, limit: int = 100, offset: int = 0,
) -> list[dict]:
    q = select(ProductionOrder).where(ProductionOrder.company_id == company_id)
    if area:
        q = q.where(ProductionOrder.area == area)
    if estado:
        q = q.where(ProductionOrder.estado == estado)
    if desde:
        q = q.where(ProductionOrder.created_at >= desde)
    if hasta:
        q = q.where(ProductionOrder.created_at <= hasta)
    q = q.order_by(ProductionOrder.created_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    orders = r.scalars().all()

    result = []
    for o in orders:
        rec_nombre = None
        if o.receta_id:
            rec_r = await db.execute(select(ProductionRecipe.nombre).where(ProductionRecipe.id == o.receta_id))
            rec_nombre = rec_r.scalar_one_or_none()
        resp_nombre = None
        if o.responsable_id:
            resp_nombre = await _get_user_name(db, o.responsable_id)
        result.append({
            **{c.name: getattr(o, c.name) for c in o.__table__.columns},
            "receta_nombre": rec_nombre,
            "responsable_nombre": resp_nombre,
        })
    return result


async def get_order(db: AsyncSession, order_id: str) -> Optional[dict]:
    r = await db.execute(select(ProductionOrder).where(ProductionOrder.id == order_id))
    o = r.scalar_one_or_none()
    if not o:
        return None
    rec_nombre = None
    if o.receta_id:
        rec_r = await db.execute(select(ProductionRecipe.nombre).where(ProductionRecipe.id == o.receta_id))
        rec_nombre = rec_r.scalar_one_or_none()
    resp_nombre = None
    if o.responsable_id:
        resp_nombre = await _get_user_name(db, o.responsable_id)
    return {
        **{c.name: getattr(o, c.name) for c in o.__table__.columns},
        "receta_nombre": rec_nombre,
        "responsable_nombre": resp_nombre,
    }


async def create_order(db: AsyncSession, company_id: str, data: ProductionOrderCreate) -> dict:
    rec_r = await db.execute(select(ProductionRecipe).where(ProductionRecipe.id == data.receta_id))
    rec = rec_r.scalar_one_or_none()
    if not rec:
        raise ValueError("Receta no encontrada")
    o = ProductionOrder(
        company_id=company_id,
        receta_id=data.receta_id,
        area=rec.area,
        cantidad_objetivo=data.cantidad_objetivo,
        estado="planificada",
        fecha_inicio=data.fecha_inicio,
        fecha_vencimiento=data.fecha_vencimiento,
        responsable_id=data.responsable_id,
        notas=data.notas,
    )
    db.add(o)
    await db.commit()
    return await get_order(db, str(o.id))


async def update_order(db: AsyncSession, order_id: str, data: ProductionOrderUpdate) -> Optional[dict]:
    r = await db.execute(select(ProductionOrder).where(ProductionOrder.id == order_id))
    o = r.scalar_one_or_none()
    if not o:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(o, key, val)
    await db.commit()
    return await get_order(db, order_id)


async def complete_order(
    db: AsyncSession, order_id: str, producto_obtenido: Decimal,
    insumos_usados: Optional[dict] = None, costo_unitario: Optional[Decimal] = None,
    fecha_vencimiento: Optional[date] = None, lote_codigo: Optional[str] = None,
) -> Optional[dict]:
    r = await db.execute(select(ProductionOrder).where(ProductionOrder.id == order_id))
    o = r.scalar_one_or_none()
    if not o:
        return None
    o.estado = "completada"
    o.fecha_fin = datetime.utcnow()
    o.producto_obtenido = producto_obtenido
    if insumos_usados is not None:
        o.insumos_usados = insumos_usados
    if o.cantidad_objetivo and producto_obtenido > 0:
        o.rendimiento_real = (producto_obtenido / o.cantidad_objetivo) * 100
    await db.flush()

    rec = await db.get(ProductionRecipe, o.receta_id)
    target_product_id = rec.producto_terminado_id if rec else None
    batch = ProductionBatch(
        company_id=o.company_id,
        orden_id=o.id,
        producto_id=target_product_id,
        cantidad_obtenida=producto_obtenido,
        fecha_vencimiento=fecha_vencimiento or date.today() + timedelta(days=7),
        lote_codigo=lote_codigo,
        costo_unitario=costo_unitario,
    )
    db.add(batch)
    await db.commit()
    return await get_order(db, order_id)


# ============================================================
# WASTE LOGS
# ============================================================

async def list_waste(
    db: AsyncSession, company_id: str, area: Optional[str] = None,
    tipo_merma: Optional[str] = None, desde: Optional[datetime] = None,
    hasta: Optional[datetime] = None, limit: int = 100, offset: int = 0,
) -> list[dict]:
    q = select(WasteLog).where(WasteLog.company_id == company_id)
    if area:
        q = q.where(WasteLog.area == area)
    if tipo_merma:
        q = q.where(WasteLog.tipo_merma == tipo_merma)
    if desde:
        q = q.where(WasteLog.fecha >= desde)
    if hasta:
        q = q.where(WasteLog.fecha <= hasta)
    q = q.order_by(WasteLog.fecha.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    logs = r.scalars().all()

    result = []
    for w in logs:
        prod_nombre = await _get_product_name(db, w.producto_id)
        result.append({
            **{c.name: getattr(w, c.name) for c in w.__table__.columns},
            "producto_nombre": prod_nombre,
        })
    return result


async def get_waste_by_area(db: AsyncSession, company_id: str, desde: Optional[datetime] = None, hasta: Optional[datetime] = None) -> list[dict]:
    q = select(
        WasteLog.area,
        sa_func.sum(WasteLog.cantidad).label("total_cantidad"),
        sa_func.sum(WasteLog.costo_total).label("total_costo"),
        sa_func.count(WasteLog.id).label("cantidad_ordenes"),
    ).where(WasteLog.company_id == company_id)
    if desde:
        q = q.where(WasteLog.fecha >= desde)
    if hasta:
        q = q.where(WasteLog.fecha <= hasta)
    q = q.group_by(WasteLog.area)
    r = await db.execute(q)
    rows = r.all()
    return [
        {"area": row.area, "total_cantidad": float(row.total_cantidad or 0),
         "total_costo": float(row.total_costo or 0), "cantidad_ordenes": row.cantidad_ordenes}
        for row in rows
    ]


async def create_waste(db: AsyncSession, company_id: str, data: WasteLogCreate, user_id: str) -> dict:
    costo_total = None
    if data.costo_unitario and data.cantidad:
        costo_total = data.costo_unitario * data.cantidad
    w = WasteLog(
        company_id=company_id,
        area=data.area,
        producto_id=data.producto_id,
        cantidad=data.cantidad,
        costo_unitario=data.costo_unitario,
        costo_total=costo_total,
        tipo_merma=data.tipo_merma,
        motivo=data.motivo,
        registrado_por=user_id,
    )
    db.add(w)
    await db.commit()
    prod_nombre = await _get_product_name(db, w.producto_id)
    return {
        **{c.name: getattr(w, c.name) for c in w.__table__.columns},
        "producto_nombre": prod_nombre,
    }


# ============================================================
# PERISHABLE CONFIG
# ============================================================

async def list_perishable_configs(db: AsyncSession, company_id: str, categoria: Optional[str] = None) -> list[dict]:
    q = select(PerishableConfig).where(PerishableConfig.company_id == company_id)
    if categoria:
        q = q.where(PerishableConfig.categoria_perecedera == categoria)
    r = await db.execute(q)
    configs = r.scalars().all()
    result = []
    for c in configs:
        prod_nombre = await _get_product_name(db, c.producto_id)
        result.append({
            **{col.name: getattr(c, col.name) for col in c.__table__.columns},
            "producto_nombre": prod_nombre,
        })
    return result


async def upsert_perishable_config(db: AsyncSession, company_id: str, data: PerishableConfigCreate) -> dict:
    r = await db.execute(
        select(PerishableConfig).where(
            PerishableConfig.company_id == company_id,
            PerishableConfig.producto_id == data.producto_id,
        )
    )
    existing = r.scalar_one_or_none()
    if existing:
        existing.vida_util_dias = data.vida_util_dias
        existing.requiere_markdown = data.requiere_markdown
        existing.categoria_perecedera = data.categoria_perecedera
    else:
        existing = PerishableConfig(
            company_id=company_id,
            producto_id=data.producto_id,
            vida_util_dias=data.vida_util_dias,
            requiere_markdown=data.requiere_markdown,
            categoria_perecedera=data.categoria_perecedera,
        )
        db.add(existing)
    await db.commit()
    prod_nombre = await _get_product_name(db, existing.producto_id)
    return {
        **{col.name: getattr(existing, col.name) for col in existing.__table__.columns},
        "producto_nombre": prod_nombre,
    }


# ============================================================
# MARKDOWNS
# ============================================================

async def list_active_markdowns(db: AsyncSession, company_id: str) -> list[dict]:
    q = select(MarkdownLog).where(
        MarkdownLog.company_id == company_id,
        MarkdownLog.activo == True,
    ).order_by(MarkdownLog.fecha_inicio.desc())
    r = await db.execute(q)
    marks = r.scalars().all()
    result = []
    for m in marks:
        prod_nombre = await _get_product_name(db, m.producto_id)
        result.append({
            **{col.name: getattr(m, col.name) for col in m.__table__.columns},
            "producto_nombre": prod_nombre,
        })
    return result


async def create_markdown(db: AsyncSession, company_id: str, data: MarkdownLogCreate, user_id: str) -> dict:
    precio_markdown = data.precio_original * (1 - data.descuento_porcentaje / 100)
    m = MarkdownLog(
        company_id=company_id,
        producto_id=data.producto_id,
        lote_id=data.lote_id,
        descuento_porcentaje=data.descuento_porcentaje,
        precio_original=data.precio_original,
        precio_markdown=precio_markdown,
        fecha_fin=data.fecha_fin,
        activo=True,
        creado_por=user_id,
        motivo=data.motivo,
    )
    db.add(m)
    await db.commit()
    prod_nombre = await _get_product_name(db, m.producto_id)
    return {
        **{col.name: getattr(m, col.name) for col in m.__table__.columns},
        "producto_nombre": prod_nombre,
    }


async def deactivate_markdown(db: AsyncSession, markdown_id: str) -> bool:
    r = await db.execute(select(MarkdownLog).where(MarkdownLog.id == markdown_id))
    m = r.scalar_one_or_none()
    if not m:
        return False
    m.activo = False
    m.fecha_fin = datetime.utcnow()
    await db.commit()
    return True


# ============================================================
# AUTO-MARKDOWN (triggered by cron/event)
# ============================================================

async def auto_apply_markdowns(db: AsyncSession, company_id: str) -> int:
    """Apply automatic markdowns to perishable products nearing expiry."""
    today = date.today()
    configs_q = select(PerishableConfig).where(
        PerishableConfig.company_id == company_id,
        PerishableConfig.requiere_markdown == True,
    )
    configs_r = await db.execute(configs_q)
    configs = configs_r.scalars().all()

    applied = 0
    for cfg in configs:
        batches_q = select(ProductionBatch).where(
            ProductionBatch.company_id == company_id,
            ProductionBatch.producto_id == cfg.producto_id,
            ProductionBatch.fecha_vencimiento <= today + timedelta(days=cfg.vida_util_dias * 0.3),
            ProductionBatch.fecha_vencimiento > today,
        ).order_by(ProductionBatch.fecha_vencimiento)
        batches_r = await db.execute(batches_q)
        batches = batches_r.scalars().all()

        for batch in batches:
            remaining_days = (batch.fecha_vencimiento - today).days
            remaining_ratio = remaining_days / cfg.vida_util_dias if cfg.vida_util_dias > 0 else 0

            discount = 0
            zone = "verde"
            if remaining_ratio < 0.1:
                discount = 50
                zone = "rojo"
            elif remaining_ratio < 0.3:
                discount = 20
                zone = "amarillo"

            if discount > 0 and batch.costo_unitario:
                existing_q = select(MarkdownLog).where(
                    MarkdownLog.company_id == company_id,
                    MarkdownLog.lote_id == batch.id,
                    MarkdownLog.activo == True,
                )
                existing_r = await db.execute(existing_q)
                if not existing_r.scalar_one_or_none():
                    await create_markdown(
                        db, company_id,
                        MarkdownLogCreate(
                            producto_id=str(batch.producto_id),
                            lote_id=str(batch.id),
                            descuento_porcentaje=Decimal(str(discount)),
                            precio_original=batch.costo_unitario * Decimal("1.3"),
                            motivo=f"Markdown automático zona {zone} — {remaining_days}d restantes",
                        ),
                        user_id="00000000-0000-0000-0000-000000000000",
                    )
                    applied += 1
    return applied


# ============================================================
# FORECASTING
# ============================================================

async def generate_forecast(db: AsyncSession, company_id: str, lookback_days: int = 90) -> int:
    """Simple forecast based on historical sales by day-of-week average."""
    from api.src.sales.models import SaleItem, Sale
    from sqlalchemy import cast, Date

    cutoff = date.today() - timedelta(days=lookback_days)
    today = date.today()
    next_30 = [today + timedelta(days=i) for i in range(30)]

    products_q = select(Product.id).where(Product.company_id == company_id)
    products_r = await db.execute(products_q)
    product_ids = [r[0] for r in products_r.all()]

    generated = 0
    for pid in product_ids:
        hist_q = select(
            cast(Sale.created_at, Date).label("sale_date"),
            sa_func.sum(SaleItem.cantidad).label("total_qty"),
        ).select_from(SaleItem).join(Sale).where(
            Sale.company_id == company_id,
            SaleItem.producto_id == pid,
            cast(Sale.created_at, Date) >= cutoff,
        ).group_by(cast(Sale.created_at, Date))
        hist_r = await db.execute(hist_q)
        hist_rows = hist_r.all()

        if not hist_rows:
            continue

        dow_totals = {}
        dow_counts = {}
        for row in hist_rows:
            dow = row.sale_date.weekday()
            dow_totals[dow] = dow_totals.get(dow, 0) + float(row.total_qty or 0)
            dow_counts[dow] = dow_counts.get(dow, 0) + 1

        dow_avg = {d: dow_totals[d] / dow_counts[d] for d in dow_totals}

        for future_date in next_30:
            dow = future_date.weekday()
            avg_qty = dow_avg.get(dow, sum(dow_avg.values()) / len(dow_avg) if dow_avg else 0)
            if avg_qty == 0:
                continue

            existing_q = select(PurchaseForecast).where(
                PurchaseForecast.company_id == company_id,
                PurchaseForecast.producto_id == pid,
                PurchaseForecast.fecha_pronosticada == future_date,
            )
            existing_r = await db.execute(existing_q)
            if existing_r.scalar_one_or_none():
                continue

            forecast = PurchaseForecast(
                company_id=company_id,
                producto_id=pid,
                fecha_pronosticada=future_date,
                cantidad_pronosticada=Decimal(str(round(avg_qty, 3))),
                confianza=Decimal("70"),
                periodo_used=lookback_days,
            )
            db.add(forecast)
            generated += 1

    await db.commit()
    return generated


async def get_forecasts(
    db: AsyncSession, company_id: str, producto_id: Optional[str] = None,
    desde: Optional[date] = None, hasta: Optional[date] = None, limit: int = 100,
) -> list[dict]:
    q = select(PurchaseForecast).where(PurchaseForecast.company_id == company_id)
    if producto_id:
        q = q.where(PurchaseForecast.producto_id == producto_id)
    if desde:
        q = q.where(PurchaseForecast.fecha_pronosticada >= desde)
    if hasta:
        q = q.where(PurchaseForecast.fecha_pronosticada <= hasta)
    q = q.order_by(PurchaseForecast.fecha_pronosticada).limit(limit)
    r = await db.execute(q)
    forecasts = r.scalars().all()
    result = []
    for f in forecasts:
        prod_nombre = await _get_product_name(db, f.producto_id)
        result.append({
            **{col.name: getattr(f, col.name) for col in f.__table__.columns},
            "producto_nombre": prod_nombre,
        })
    return result


# ============================================================
# PURCHASE SUGGESTIONS
# ============================================================

async def generate_suggestions(db: AsyncSession, company_id: str) -> int:
    """Generate purchase suggestions based on forecasts and current stock."""
    from api.src.products.models import Product
    from api.src.inventory.models import Stock, StockLot

    today = date.today()
    forecasts_q = select(
        PurchaseForecast.producto_id,
        sa_func.sum(PurchaseForecast.cantidad_pronosticada).label("total_forecast"),
    ).where(
        PurchaseForecast.company_id == company_id,
        PurchaseForecast.fecha_pronosticada >= today,
        PurchaseForecast.fecha_pronosticada <= today + timedelta(days=7),
    ).group_by(PurchaseForecast.producto_id)
    forecasts_r = await db.execute(forecasts_q)
    forecast_totals = {r.producto_id: float(r.total_forecast) for r in forecasts_r.all()}

    generated = 0
    for pid_str, forecast_qty in forecast_totals.items():
        pid = pid_str if isinstance(pid_str, UUID) else UUID(pid_str)

        stock_r = await db.execute(
            select(sa_func.coalesce(sa_func.sum(Stock.cantidad), 0))
            .where(Stock.company_id == company_id, Stock.producto_id == pid)
        )
        current_stock = float(stock_r.scalar() or 0)

        pending_r = await db.execute(
            select(sa_func.coalesce(sa_func.sum(StockLot.cantidad_disponible), 0))
            .where(StockLot.company_id == company_id, StockLot.producto_id == pid)
        )
        pending = float(pending_r.scalar() or 0)

        needed = forecast_qty - current_stock - pending
        if needed <= 0:
            continue

        existing_q = select(PurchaseSuggestion).where(
            PurchaseSuggestion.company_id == company_id,
            PurchaseSuggestion.producto_id == pid,
            PurchaseSuggestion.estado.in_(["pendiente", "aprobada"]),
        )
        existing_r = await db.execute(existing_q)
        if existing_r.scalar_one_or_none():
            continue

        suggestion = PurchaseSuggestion(
            company_id=company_id,
            producto_id=pid,
            cantidad_sugerida=Decimal(str(round(needed, 3))),
            cantidad_stock_actual=Decimal(str(round(current_stock, 3))),
            cantidad_pendiente_recibir=Decimal(str(round(pending, 3))),
            cantidad_pronosticada=Decimal(str(round(forecast_qty, 3))),
            estado="pendiente",
        )
        db.add(suggestion)
        generated += 1

    await db.commit()
    return generated


async def list_suggestions(
    db: AsyncSession, company_id: str, estado: Optional[str] = None,
    limit: int = 100, offset: int = 0,
) -> list[dict]:
    q = select(PurchaseSuggestion).where(PurchaseSuggestion.company_id == company_id)
    if estado:
        q = q.where(PurchaseSuggestion.estado == estado)
    q = q.order_by(PurchaseSuggestion.created_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    suggestions = r.scalars().all()
    result = []
    for s in suggestions:
        prod_nombre = await _get_product_name(db, s.producto_id)
        prov_nombre = None
        if s.proveedor_id:
            prov_nombre = await _get_supplier_name(db, s.proveedor_id)
        result.append({
            **{col.name: getattr(s, col.name) for col in s.__table__.columns},
            "producto_nombre": prod_nombre,
            "proveedor_nombre": prov_nombre,
        })
    return result


async def update_suggestion(db: AsyncSession, suggestion_id: str, data: PurchaseSuggestionUpdate) -> Optional[dict]:
    r = await db.execute(select(PurchaseSuggestion).where(PurchaseSuggestion.id == suggestion_id))
    s = r.scalar_one_or_none()
    if not s:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(s, key, val)
    await db.commit()
    prod_nombre = await _get_product_name(db, s.producto_id)
    prov_nombre = None
    if s.proveedor_id:
        prov_nombre = await _get_supplier_name(db, s.proveedor_id)
    return {
        **{col.name: getattr(s, col.name) for col in s.__table__.columns},
        "producto_nombre": prod_nombre,
        "proveedor_nombre": prov_nombre,
    }


# ============================================================
# DASHBOARD
# ============================================================

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    today = date.today()
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start.replace(hour=23, minute=59, second=59)

    # Active orders
    r1 = await db.execute(
        select(sa_func.count(ProductionOrder.id)).where(
            ProductionOrder.company_id == company_id,
            ProductionOrder.estado.in_(["planificada", "en_progreso"]),
        )
    )
    ordenes_activas = r1.scalar() or 0

    # Orders today
    r2 = await db.execute(
        select(sa_func.count(ProductionOrder.id)).where(
            ProductionOrder.company_id == company_id,
            ProductionOrder.created_at >= today_start,
            ProductionOrder.created_at <= today_end,
        )
    )
    ordenes_hoy = r2.scalar() or 0

    # Total produced today
    r3 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(ProductionOrder.producto_obtenido), 0)).where(
            ProductionOrder.company_id == company_id,
            ProductionOrder.fecha_fin >= today_start,
            ProductionOrder.fecha_fin <= today_end,
            ProductionOrder.estado == "completada",
        )
    )
    total_producido_hoy = r3.scalar() or 0

    # Waste today
    r4 = await db.execute(
        select(
            sa_func.coalesce(sa_func.sum(WasteLog.cantidad), 0),
            sa_func.coalesce(sa_func.sum(WasteLog.costo_total), 0),
        ).where(
            WasteLog.company_id == company_id,
            WasteLog.fecha >= today_start,
            WasteLog.fecha <= today_end,
        )
    )
    merma_row = r4.first()
    merma_cantidad = float(merma_row[0] or 0)
    merma_costo = float(merma_row[1] or 0)
    merma_pct = Decimal("0")
    if total_producido_hoy and float(total_producido_hoy) > 0:
        merma_pct = Decimal(str(round((merma_cantidad / float(total_producido_hoy)) * 100, 2)))

    # Active markdowns
    r5 = await db.execute(
        select(sa_func.count(MarkdownLog.id)).where(
            MarkdownLog.company_id == company_id,
            MarkdownLog.activo == True,
        )
    )
    productos_en_markdown = r5.scalar() or 0

    # Expiring in 30 days
    r6 = await db.execute(
        select(sa_func.count(ProductionBatch.id)).where(
            ProductionBatch.company_id == company_id,
            ProductionBatch.fecha_vencimiento <= today + timedelta(days=30),
            ProductionBatch.fecha_vencimiento > today,
        )
    )
    productos_por_vencer_30d = r6.scalar() or 0

    # Critical (expired or < 3 days)
    r7 = await db.execute(
        select(sa_func.count(ProductionBatch.id)).where(
            ProductionBatch.company_id == company_id,
            ProductionBatch.fecha_vencimiento <= today + timedelta(days=3),
        )
    )
    alertas_criticas = r7.scalar() or 0

    # Average yield
    r8 = await db.execute(
        select(sa_func.avg(ProductionOrder.rendimiento_real)).where(
            ProductionOrder.company_id == company_id,
            ProductionOrder.estado == "completada",
            ProductionOrder.rendimiento_real.isnot(None),
        )
    )
    rendimiento_promedio = r8.scalar()

    # Pending suggestions
    r9 = await db.execute(
        select(sa_func.count(PurchaseSuggestion.id)).where(
            PurchaseSuggestion.company_id == company_id,
            PurchaseSuggestion.estado == "pendiente",
        )
    )
    sugerencias_pendientes = r9.scalar() or 0

    # Last forecast
    r10 = await db.execute(
        select(sa_func.max(PurchaseForecast.fecha_generacion)).where(
            PurchaseForecast.company_id == company_id,
        )
    )
    forecast_actualizacion = r10.scalar()

    return {
        "ordenes_activas": ordenes_activas,
        "ordenes_hoy": ordenes_hoy,
        "total_producido_hoy": total_producido_hoy,
        "merma_diaria_total": merma_cantidad,
        "merma_diaria_porcentaje": merma_pct,
        "productos_en_markdown": productos_en_markdown,
        "productos_por_vencer_30d": productos_por_vencer_30d,
        "alertas_criticas": alertas_criticas,
        "rendimiento_promedio": rendimiento_promedio,
        "sugerencias_pendientes": sugerencias_pendientes,
        "forecast_actualizacion": forecast_actualizacion,
    }


async def get_production_by_area(db: AsyncSession, company_id: str, desde: Optional[datetime] = None, hasta: Optional[datetime] = None) -> list[dict]:
    q = select(
        ProductionOrder.area,
        sa_func.coalesce(sa_func.sum(ProductionOrder.producto_obtenido), 0).label("total_producido"),
        sa_func.count(ProductionOrder.id).label("ordenes_completadas"),
        sa_func.avg(ProductionOrder.rendimiento_real).label("rendimiento_promedio"),
    ).where(
        ProductionOrder.company_id == company_id,
        ProductionOrder.estado == "completada",
    )
    if desde:
        q = q.where(ProductionOrder.fecha_fin >= desde)
    if hasta:
        q = q.where(ProductionOrder.fecha_fin <= hasta)
    q = q.group_by(ProductionOrder.area)
    r = await db.execute(q)
    prod_rows = r.all()

    waste_q = select(
        WasteLog.area,
        sa_func.coalesce(sa_func.sum(WasteLog.cantidad), 0).label("merma_cantidad"),
        sa_func.coalesce(sa_func.sum(WasteLog.costo_total), 0).label("merma_costo"),
    ).where(WasteLog.company_id == company_id)
    if desde:
        waste_q = waste_q.where(WasteLog.fecha >= desde)
    if hasta:
        waste_q = waste_q.where(WasteLog.fecha <= hasta)
    waste_q = waste_q.group_by(WasteLog.area)
    waste_r = await db.execute(waste_q)
    waste_map = {row.area: row for row in waste_r.all()}

    result = []
    for row in prod_rows:
        w = waste_map.get(row.area)
        result.append({
            "area": row.area,
            "total_producido": float(row.total_producido or 0),
            "ordenes_completadas": row.ordenes_completadas,
            "rendimiento_promedio": float(row.rendimiento_promedio) if row.rendimiento_promedio else None,
            "merma_cantidad": float(w.merma_cantidad) if w else 0,
            "merma_costo": float(w.merma_costo) if w else 0,
        })
    return result


# ============================================================
# BUTCHERY — DESPOSTE (multi-output + costeo ponderado)
# ============================================================

async def list_butchery_templates(db: AsyncSession, company_id: str, activa: Optional[bool] = None) -> list[dict]:
    q = select(ButcheryTemplate).where(ButcheryTemplate.company_id == company_id)
    if activa is not None:
        q = q.where(ButcheryTemplate.activa == activa)
    q = q.order_by(ButcheryTemplate.nombre)
    r = await db.execute(q)
    templates = r.scalars().all()

    result = []
    for t in templates:
        cuts_q = select(ButcheryTemplateCut).where(ButcheryTemplateCut.template_id == t.id).order_by(ButcheryTemplateCut.orden)
        cuts_r = await db.execute(cuts_q)
        cuts = cuts_r.scalars().all()
        result.append({
            **{c.name: getattr(t, c.name) for c in t.__table__.columns},
            "cuts": [
                {
                    **{c.name: getattr(cut, c.name) for c in cut.__table__.columns},
                    "producto_nombre": await _get_product_name(db, cut.producto_id),
                }
                for cut in cuts
            ],
        })
    return result


async def get_butchery_template(db: AsyncSession, template_id: str) -> Optional[dict]:
    r = await db.execute(select(ButcheryTemplate).where(ButcheryTemplate.id == template_id))
    t = r.scalar_one_or_none()
    if not t:
        return None
    cuts_q = select(ButcheryTemplateCut).where(ButcheryTemplateCut.template_id == t.id).order_by(ButcheryTemplateCut.orden)
    cuts_r = await db.execute(cuts_q)
    cuts = cuts_r.scalars().all()
    return {
        **{c.name: getattr(t, c.name) for c in t.__table__.columns},
        "cuts": [
            {
                **{c.name: getattr(cut, c.name) for c in cut.__table__.columns},
                "producto_nombre": await _get_product_name(db, cut.producto_id),
            }
            for cut in cuts
        ],
    }


async def create_butchery_template(db: AsyncSession, company_id: str, data) -> dict:
    t = ButcheryTemplate(
        company_id=company_id,
        nombre=data.nombre,
        especie=data.especie,
        peso_promedio_kg=data.peso_promedio_kg,
        descripcion=data.descripcion,
    )
    db.add(t)
    await db.flush()

    total_ponderado = sum(float(c.precio_ponderado) for c in data.cuts)
    for i, cut in enumerate(data.cuts):
        ponderado = float(cut.precio_ponderado)
        if total_ponderado > 0 and i == len(data.cuts) - 1 and total_ponderado != 100:
            ponderado = 100 - sum(float(c.precio_ponderado) for c in data.cuts[:i])
        tc = ButcheryTemplateCut(
            template_id=t.id,
            producto_id=cut.producto_id,
            rendimiento_porcentual=cut.rendimiento_porcentual,
            precio_ponderado=Decimal(str(ponderado)),
            orden=cut.orden if cut.orden else i,
            es_subproducto=cut.es_subproducto,
        )
        db.add(tc)
    await db.commit()
    return await get_butchery_template(db, str(t.id))


async def execute_desposte(db: AsyncSession, company_id: str, data) -> dict:
    """Execute a butchery desposte: 1 input → multi-output with weighted costing."""
    r = await db.execute(select(ButcheryTemplate).where(ButcheryTemplate.id == data.template_id))
    template = r.scalar_one_or_none()
    if not template:
        raise ValueError("Plantilla de desposte no encontrada")

    cuts_q = select(ButcheryTemplateCut).where(
        ButcheryTemplateCut.template_id == template.id
    ).order_by(ButcheryTemplateCut.orden)
    cuts_r = await db.execute(cuts_q)
    cuts = cuts_r.scalars().all()
    if not cuts:
        raise ValueError("La plantilla no tiene cortes definidos")

    peso_entrada = data.peso_entrada_kg
    costo_total = data.costo_total_gs
    fecha_venc = data.fecha_vencimiento or date.today() + timedelta(days=14)

    order = ProductionOrder(
        company_id=company_id,
        area="carniceria",
        cantidad_objetivo=peso_entrada,
        estado="completada",
        fecha_inicio=datetime.utcnow(),
        fecha_fin=datetime.utcnow(),
        fecha_vencimiento=fecha_venc,
        responsable_id=data.responsable_id,
        notas=data.notas or f"Desposte {template.nombre} — {float(peso_entrada)}kg",
    )
    db.add(order)
    await db.flush()

    total_ponderado = sum(float(c.precio_ponderado) for c in cuts)
    peso_total_obtenido = Decimal("0")
    batches = []
    corte_results = []

    for cut in cuts:
        rend = float(cut.rendimiento_porcentual) / 100
        peso_obtenido = peso_entrada * Decimal(str(rend))
        peso_obtenido = peso_obtenido.quantize(Decimal("0.001"))

        ponderado_ratio = float(cut.precio_ponderado) / total_ponderado if total_ponderado > 0 else 1 / len(cuts)
        costo_asignado = costo_total * Decimal(str(ponderado_ratio))
        costo_unitario = (costo_asignado / peso_obtenido).quantize(Decimal("0.01")) if peso_obtenido > 0 else Decimal("0")

        batch = ProductionBatch(
            company_id=company_id,
            orden_id=order.id,
            producto_id=cut.producto_id,
            cantidad_obtenida=peso_obtenido,
            fecha_vencimiento=fecha_venc,
            lote_codigo=f"DES{datetime.utcnow().strftime('%y%m%d')}-{cut.orden:02d}",
            costo_unitario=costo_unitario,
        )
        db.add(batch)
        batches.append(batch)
        peso_total_obtenido += peso_obtenido
        prod_nombre = await _get_product_name(db, cut.producto_id)
        corte_results.append({
            "producto_id": str(cut.producto_id),
            "producto_nombre": prod_nombre,
            "rendimiento_esperado": float(cut.rendimiento_porcentual),
            "peso_obtenido_kg": float(peso_obtenido),
            "costo_unitario_gs": float(costo_unitario),
            "precio_ponderado": float(cut.precio_ponderado),
            "es_subproducto": cut.es_subproducto,
        })

    await db.flush()

    merma = peso_entrada - peso_total_obtenido
    merma_pct = (merma / peso_entrada * 100).quantize(Decimal("0.01")) if peso_entrada > 0 else Decimal("0")
    if merma > 0:
        waste = WasteLog(
            company_id=company_id,
            area="carniceria",
            producto_id=template.id,
            cantidad=merma,
            tipo_merma="merma_natural",
            motivo=f"Merma de desposte {template.nombre} — {float(merma):.2f}kg ({float(merma_pct):.1f}%)",
            registrado_por=data.responsable_id,
        )
        db.add(waste)

    order.producto_obtenido = peso_total_obtenido
    order.rendimiento_real = ((peso_total_obtenido / peso_entrada) * 100).quantize(Decimal("0.01")) if peso_entrada > 0 else Decimal("0")
    order.insumos_usados = {
        "template_id": str(template.id),
        "template_nombre": template.nombre,
        "peso_entrada_kg": float(peso_entrada),
        "costo_total_gs": float(costo_total),
        "merma_kg": float(merma),
    }

    await db.commit()

    batch_responses = []
    for b in batches:
        prod_nombre = await _get_product_name(db, b.producto_id)
        batch_responses.append({
            **{col.name: getattr(b, col.name) for col in b.__table__.columns},
            "producto_nombre": prod_nombre,
        })

    return {
        "orden_id": str(order.id),
        "template_nombre": template.nombre,
        "peso_entrada_kg": float(peso_entrada),
        "costo_total_gs": float(costo_total),
        "peso_total_obtenido": float(peso_total_obtenido),
        "merma_kg": float(merma),
        "merma_porcentaje": float(merma_pct),
        "cortes": corte_results,
        "batches": batch_responses,
    }


async def get_butchery_orders(db: AsyncSession, company_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
    q = select(ProductionOrder).where(
        ProductionOrder.company_id == company_id,
        ProductionOrder.area == "carniceria",
    ).order_by(ProductionOrder.created_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    orders = r.scalars().all()
    result = []
    for o in orders:
        batches_q = select(
            ProductionBatch.producto_id,
            sa_func.sum(ProductionBatch.cantidad_obtenida).label("total_obtenido"),
        ).where(ProductionBatch.orden_id == o.id).group_by(ProductionBatch.producto_id)
        batches_r = await db.execute(batches_q)
        cortes = []
        for row in batches_r.all():
            prod_nombre = await _get_product_name(db, row.producto_id)
            cortes.append({"producto_id": str(row.producto_id), "producto_nombre": prod_nombre, "cantidad": float(row.total_obtenido or 0)})
        result.append({
            **{c.name: getattr(o, c.name) for c in o.__table__.columns},
            "cortes": cortes,
        })
    return result


async def get_butchery_yield_report(
    db: AsyncSession, company_id: str, desde: Optional[datetime] = None, hasta: Optional[datetime] = None,
) -> list[dict]:
    q = select(ProductionOrder).where(
        ProductionOrder.company_id == company_id,
        ProductionOrder.area == "carniceria",
        ProductionOrder.estado == "completada",
    )
    if desde:
        q = q.where(ProductionOrder.fecha_fin >= desde)
    if hasta:
        q = q.where(ProductionOrder.fecha_fin <= hasta)
    q = q.order_by(ProductionOrder.fecha_fin.desc())
    r = await db.execute(q)
    orders = r.scalars().all()

    report = []
    for o in orders:
        insumos = o.insumos_usados or {}
        template_nombre = insumos.get("template_nombre", "N/A")
        peso_entrada = float(insumos.get("peso_entrada_kg", 0))
        costo_total = float(insumos.get("costo_total_gs", 0))

        batches_q = select(
            ProductionBatch.producto_id,
            sa_func.sum(ProductionBatch.cantidad_obtenida).label("total_obtenido"),
        ).where(ProductionBatch.orden_id == o.id).group_by(ProductionBatch.producto_id)
        batches_r = await db.execute(batches_q)
        corte_results = []
        for row in batches_r.all():
            prod_nombre = await _get_product_name(db, row.producto_id)
            corte_results.append({
                "producto_id": str(row.producto_id),
                "producto_nombre": prod_nombre,
                "peso_obtenido": float(row.total_obtenido or 0),
            })

        peso_obtenido = sum(c["peso_obtenido"] for c in corte_results)
        merma = peso_entrada - peso_obtenido
        merma_pct = (merma / peso_entrada * 100) if peso_entrada > 0 else 0

        report.append({
            "orden_id": str(o.id),
            "template_nombre": template_nombre,
            "fecha": o.fecha_fin.isoformat() if o.fecha_fin else None,
            "peso_entrada": round(peso_entrada, 2),
            "costo_total": round(costo_total, 2),
            "peso_obtenido": round(peso_obtenido, 2),
            "rendimiento": round(peso_obtenido / peso_entrada * 100, 2) if peso_entrada > 0 else 0,
            "merma_kg": round(merma, 2),
            "merma_porcentaje": round(merma_pct, 2),
            "cortes": corte_results,
        })
    return report


# ============================================================
# BAKERY — PLAN DIARIO + RECETAS ESCALABLES
# ============================================================

async def list_bakery_plans(db: AsyncSession, company_id: str, dia_semana: Optional[int] = None) -> list[dict]:
    q = select(BakeryDailyPlan).where(BakeryDailyPlan.company_id == company_id)
    if dia_semana is not None:
        q = q.where(BakeryDailyPlan.dia_semana == dia_semana)
    q = q.order_by(BakeryDailyPlan.dia_semana, BakeryDailyPlan.nombre)
    r = await db.execute(q)
    plans = r.scalars().all()

    result = []
    for p in plans:
        items_q = select(BakeryPlanItem).where(BakeryPlanItem.plan_id == p.id).order_by(BakeryPlanItem.prioridad)
        items_r = await db.execute(items_q)
        items = items_r.scalars().all()
        result.append({
            **{c.name: getattr(p, c.name) for c in p.__table__.columns},
            "items": [
                {
                    **{c.name: getattr(it, c.name) for c in it.__table__.columns},
                    "receta_nombre": await _get_recipe_name(db, it.receta_id),
                }
                for it in items
            ],
        })
    return result


async def get_bakery_plan(db: AsyncSession, plan_id: str) -> Optional[dict]:
    r = await db.execute(select(BakeryDailyPlan).where(BakeryDailyPlan.id == plan_id))
    p = r.scalar_one_or_none()
    if not p:
        return None
    items_q = select(BakeryPlanItem).where(BakeryPlanItem.plan_id == p.id).order_by(BakeryPlanItem.prioridad)
    items_r = await db.execute(items_q)
    items = items_r.scalars().all()
    return {
        **{c.name: getattr(p, c.name) for c in p.__table__.columns},
        "items": [
            {
                **{c.name: getattr(it, c.name) for c in it.__table__.columns},
                "receta_nombre": await _get_recipe_name(db, it.receta_id),
            }
            for it in items
        ],
    }


async def _get_recipe_name(db: AsyncSession, receta_id: UUID) -> Optional[str]:
    r = await db.execute(select(ProductionRecipe.nombre).where(ProductionRecipe.id == receta_id))
    row = r.scalar_one_or_none()
    return str(row) if row else None


async def create_bakery_plan(db: AsyncSession, company_id: str, data) -> dict:
    p = BakeryDailyPlan(
        company_id=company_id,
        nombre=data.nombre,
        dia_semana=data.dia_semana,
    )
    db.add(p)
    await db.flush()

    for item in data.items:
        pi = BakeryPlanItem(
            plan_id=p.id,
            receta_id=item.receta_id,
            cantidad_objetivo=item.cantidad_objetivo,
            prioridad=item.prioridad,
        )
        db.add(pi)
    await db.commit()
    return await get_bakery_plan(db, str(p.id))


async def delete_bakery_plan(db: AsyncSession, plan_id: str) -> bool:
    r = await db.execute(select(BakeryDailyPlan).where(BakeryDailyPlan.id == plan_id))
    p = r.scalar_one_or_none()
    if not p:
        return False
    await db.execute(delete(BakeryPlanItem).where(BakeryPlanItem.plan_id == p.id))
    await db.delete(p)
    await db.commit()
    return True


async def scale_recipe(db: AsyncSession, company_id: str, receta_id: str, cantidad_deseada: Decimal) -> dict:
    """Scale a recipe to produce a desired quantity."""
    r = await db.execute(select(ProductionRecipe).where(
        ProductionRecipe.id == receta_id,
        ProductionRecipe.company_id == company_id,
    ))
    rec = r.scalar_one_or_none()
    if not rec:
        raise ValueError("Receta no encontrada")

    items_q = select(ProductionRecipeItem).where(ProductionRecipeItem.receta_id == rec.id)
    items_r = await db.execute(items_q)
    items = items_r.scalars().all()

    factor = cantidad_deseada / rec.cantidad_esperada if rec.cantidad_esperada > 0 else Decimal("1")

    prod_nombre = await _get_product_name(db, rec.producto_terminado_id)
    insumos = []
    for item in items:
        insumo_nombre = await _get_product_name(db, item.producto_id)
        insumos.append({
            "producto_id": str(item.producto_id),
            "producto_nombre": insumo_nombre,
            "cantidad_base": float(item.cantidad),
            "cantidad_escalada": float((item.cantidad * factor).quantize(Decimal("0.001"))),
            "unidad": item.unidad_medida,
        })

    return {
        "receta_nombre": rec.nombre,
        "producto_terminado": prod_nombre,
        "cantidad_base": float(rec.cantidad_esperada),
        "cantidad_deseada": float(cantidad_deseada),
        "factor_escala": float(factor.quantize(Decimal("0.0001"))),
        "items": [
            {
                "producto_id": str(item.producto_id),
                "producto_nombre": await _get_product_name(db, item.producto_id),
                "cantidad": float(item.cantidad),
                "unidad": item.unidad_medida,
            }
            for item in items
        ],
        "insumos_totales": insumos,
    }


async def execute_bakery_plan(db: AsyncSession, company_id: str, data) -> dict:
    """Execute a daily plan: create one production order per item, scaled to target."""
    r = await db.execute(select(BakeryDailyPlan).where(
        BakeryDailyPlan.id == data.plan_id,
        BakeryDailyPlan.company_id == company_id,
    ))
    plan = r.scalar_one_or_none()
    if not plan:
        raise ValueError("Plan diario no encontrado")

    items_q = select(BakeryPlanItem).where(BakeryPlanItem.plan_id == plan.id).order_by(BakeryPlanItem.prioridad)
    items_r = await db.execute(items_q)
    items = items_r.scalars().all()
    if not items:
        raise ValueError("El plan no tiene items")

    today = data.fecha_ejecucion or date.today()
    now = datetime.utcnow()
    ajustes = data.ajustes or {}
    ordenes = []

    for item in items:
        rec_r = await db.execute(select(ProductionRecipe).where(ProductionRecipe.id == item.receta_id))
        rec = rec_r.scalar_one_or_none()
        if not rec:
            continue

        target = ajustes.get(str(item.receta_id), item.cantidad_objetivo)
        factor = target / rec.cantidad_esperada if rec.cantidad_esperada > 0 else Decimal("1")

        insumos_q = select(ProductionRecipeItem).where(ProductionRecipeItem.receta_id == rec.id)
        insumos_r = await db.execute(insumos_q)
        insumos = insumos_r.scalars().all()

        insumos_usados = {}
        for ins in insumos:
            scaled = float((ins.cantidad * factor).quantize(Decimal("0.001")))
            insumos_usados[str(ins.producto_id)] = scaled

        order = ProductionOrder(
            company_id=company_id,
            receta_id=rec.id,
            area="panaderia",
            cantidad_objetivo=target,
            estado="planificada",
            fecha_inicio=now,
            fecha_vencimiento=today + timedelta(days=2),
            responsable_id=data.responsable_id,
            notas=data.notas or f"Plan: {plan.nombre} — {today.isoformat()}",
            insumos_usados={"plan_id": str(plan.id), "plan_nombre": plan.nombre, "insumos": insumos_usados},
        )
        db.add(order)
        await db.flush()
        ordenes.append(order)

    await db.commit()

    order_responses = []
    for o in ordenes:
        rec_nombre = await _get_recipe_name(db, o.receta_id) if o.receta_id else None
        order_responses.append({
            **{c.name: getattr(o, c.name) for c in o.__table__.columns},
            "receta_nombre": rec_nombre,
            "responsable_nombre": None,
        })

    return {
        "plan_nombre": plan.nombre,
        "fecha": today.isoformat(),
        "ordenes_creadas": len(ordenes),
        "ordenes": order_responses,
    }


# ============================================================
# VERDULERÍA — RECEPCIÓN CON CALIDAD
# ============================================================

async def list_receive_batches(db: AsyncSession, company_id: str, producto_id: Optional[str] = None,
                               proveedor_id: Optional[str] = None, limit: int = 50, offset: int = 0) -> list[dict]:
    q = select(ReceiveBatch).where(ReceiveBatch.company_id == company_id)
    if producto_id:
        q = q.where(ReceiveBatch.producto_id == producto_id)
    if proveedor_id:
        q = q.where(ReceiveBatch.proveedor_id == proveedor_id)
    q = q.order_by(ReceiveBatch.fecha_recepcion.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    batches = r.scalars().all()
    today = date.today()
    result = []
    for b in batches:
        prod_name = await _get_product_name(db, b.producto_id)
        result.append({
            **{c.name: getattr(b, c.name) for c in b.__table__.columns},
            "producto_nombre": prod_name,
            "dias_para_vencer": (b.fecha_vencimiento_estimada - today).days if b.fecha_vencimiento_estimada else None,
        })
    return result


async def create_receive_batch(db: AsyncSession, company_id: str, data: ReceiveBatchCreate, user_id: str) -> dict:
    calidad = data.calidad if data.calidad in ("premium", "estandar", "descuento", "rechazado") else "estandar"
    aceptada = data.cantidad_recibida if calidad != "rechazado" else Decimal("0")

    batch = ReceiveBatch(
        company_id=company_id,
        producto_id=data.producto_id,
        proveedor_id=data.proveedor_id,
        cantidad_recibida=data.cantidad_recibida,
        cantidad_aceptada=aceptada,
        calidad=ReceiveQualityGrade(calidad),
        precio_unitario=data.precio_unitario,
        fecha_recepcion=data.fecha_recepcion or date.today(),
        fecha_vencimiento_estimada=data.fecha_vencimiento_estimada,
        lote_proveedor=data.lote_proveedor,
        lote_codigo_interno=f"RV{date.today().strftime('%y%m%d')}-{company_id[:4]}",
        nota_calidad=data.nota_calidad,
        rechazo_motivo=data.rechazo_motivo if calidad == "rechazado" else None,
        registrado_por=user_id,
    )
    db.add(batch)
    await db.flush()

    # Si es rechazado o descuento, registrar merma inmediata
    if calidad in ("rechazado", "descuento"):
        w = WasteLog(
            company_id=company_id,
            area="verduleria",
            producto_id=data.producto_id,
            cantidad=0 if calidad == "descuento" else data.cantidad_recibida,
            costo_unitario=data.precio_unitario,
            costo_total=(data.precio_unitario or 0) * (data.cantidad_recibida if calidad == "rechazado" else 0),
            tipo_merma="merma_natural" if calidad == "descuento" else "devolucion",
            motivo=f"Calidad {calidad} en recepción: {data.rechazo_motivo or data.nota_calidad or ''}",
            registrado_por=user_id,
        )
        db.add(w)

    await db.commit()
    await db.refresh(batch)

    return {
        **{c.name: getattr(batch, c.name) for c in batch.__table__.columns},
        "producto_nombre": await _get_product_name(db, batch.producto_id),
        "dias_para_vencer": (batch.fecha_vencimiento_estimada - date.today()).days if batch.fecha_vencimiento_estimada else None,
    }


async def get_receive_batch(db: AsyncSession, batch_id: str) -> Optional[dict]:
    r = await db.execute(select(ReceiveBatch).where(ReceiveBatch.id == batch_id))
    b = r.scalar_one_or_none()
    if not b:
        return None
    prod_name = await _get_product_name(db, b.producto_id)
    return {
        **{c.name: getattr(b, c.name) for c in b.__table__.columns},
        "producto_nombre": prod_name,
        "dias_para_vencer": (b.fecha_vencimiento_estimada - date.today()).days if b.fecha_vencimiento_estimada else None,
    }


# ═══════════════════════════════════════════════════════════════
# FRESHNESS AUDIT (AUDITORÍA DIARIA)
# ═══════════════════════════════════════════════════════════════

async def list_freshness_audits(db: AsyncSession, company_id: str, producto_id: Optional[str] = None,
                                limit: int = 50, offset: int = 0) -> list[dict]:
    q = select(FreshnessAudit).where(FreshnessAudit.company_id == company_id)
    if producto_id:
        q = q.where(FreshnessAudit.producto_id == producto_id)
    q = q.order_by(FreshnessAudit.audited_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    audits = r.scalars().all()
    result = []
    for a in audits:
        prod_name = await _get_product_name(db, a.producto_id)
        batch_calidad = None
        if a.batch_id:
            br = await db.execute(select(ReceiveBatch.calidad).where(ReceiveBatch.id == a.batch_id))
            bc = br.scalar_one_or_none()
            batch_calidad = str(bc.value) if bc else None
        result.append({
            **{c.name: getattr(a, c.name) for c in a.__table__.columns},
            "producto_nombre": prod_name,
            "batch_calidad": batch_calidad,
        })
    return result


async def create_freshness_audit(db: AsyncSession, company_id: str, data: FreshnessAuditCreate, user_id: str) -> dict:
    if data.calidad_actual not in ("bueno", "regular", "malo"):
        raise ValueError("calidad_actual must be bueno/regular/malo")

    audit = FreshnessAudit(
        company_id=company_id,
        producto_id=data.producto_id,
        batch_id=data.batch_id,
        calidad_actual=FreshnessGrade(data.calidad_actual),
        firmeza=data.firmeza,
        color=data.color,
        aspecto_general=data.aspecto_general,
        notas=data.notas,
        audited_by=user_id,
    )

    # Auto-markdown si es "regular" o "malo"
    triggered = False
    if data.calidad_actual in ("regular", "malo"):
        r = await db.execute(select(Product).where(Product.id == data.producto_id, Product.company_id == company_id))
        p = r.scalar_one_or_none()
        if p and p.precio_venta and float(p.precio_venta) > 0:
            dto = Decimal("20") if data.calidad_actual == "regular" else Decimal("50")
            original = p.precio_venta
            markdown = (original * (1 - dto / 100)).quantize(Decimal("0"))
            ml = MarkdownLog(
                company_id=company_id,
                producto_id=data.producto_id,
                receive_batch_id=data.batch_id,
                descuento_porcentaje=dto,
                precio_original=original,
                precio_markdown=markdown,
                creado_por=user_id,
                motivo=f"Auditoría frescura: {data.calidad_actual}",
            )
            db.add(ml)
            triggered = True

    audit.triggered_markdown = triggered
    db.add(audit)
    await db.commit()
    await db.refresh(audit)

    prod_name = await _get_product_name(db, audit.producto_id)
    return {
        **{c.name: getattr(audit, c.name) for c in audit.__table__.columns},
        "producto_nombre": prod_name,
    }


# ═══════════════════════════════════════════════════════════════
# SUPPLIER SCORECARD
# ═══════════════════════════════════════════════════════════════

async def list_supplier_scorecards(db: AsyncSession, company_id: str, proveedor_id: Optional[str] = None,
                                   limit: int = 50, offset: int = 0) -> list[dict]:
    q = select(SupplierScorecard).where(SupplierScorecard.company_id == company_id)
    if proveedor_id:
        q = q.where(SupplierScorecard.proveedor_id == proveedor_id)
    q = q.order_by(SupplierScorecard.puntaje_general.desc().nullslast()).limit(limit).offset(offset)
    r = await db.execute(q)
    cards = r.scalars().all()
    result = []
    for c in cards:
        result.append({
            **{col.name: getattr(c, col.name) for col in c.__table__.columns},
            "proveedor_nombre": None,
            "producto_nombre": await _get_product_name(db, c.producto_id),
        })
    return result


async def generate_supplier_scorecards(db: AsyncSession, company_id: str) -> dict:
    """Generate/refresh scorecards for all suppliers based on receive batches + waste."""
    quarter_start = date.today().replace(month=((date.today().month - 1) // 3) * 3 + 1, day=1)
    if quarter_start.month <= 3:
        quarter_start = quarter_start.replace(year=quarter_start.year)
    quarter_end = date.today()

    r = await db.execute(
        select(ReceiveBatch)
        .where(
            ReceiveBatch.company_id == company_id,
            ReceiveBatch.fecha_recepcion >= quarter_start,
            ReceiveBatch.fecha_recepcion <= quarter_end,
        )
    )
    batches = r.scalars().all()

    from collections import defaultdict
    by_supplier_product = defaultdict(lambda: {"total": Decimal("0"), "sum_quality": Decimal("0"), "count": 0, "rejects": 0, "costs": []})

    for b in batches:
        if not b.proveedor_id:
            continue
        key = (str(b.proveedor_id), str(b.producto_id))
        entry = by_supplier_product[key]
        entry["total"] += b.cantidad_recibida
        entry["count"] += 1
        quality_map = {"premium": 5, "estandar": 3, "descuento": 1, "rechazado": 0}
        entry["sum_quality"] += Decimal(quality_map.get(b.calidad.value, 3))
        if b.calidad == ReceiveQualityGrade.rechazado:
            entry["rejects"] += 1
        if b.precio_unitario:
            entry["costs"].append(float(b.precio_unitario))

    # Waste by supplier+product
    waste_q = await db.execute(
        select(WasteLog.producto_id, sa_func.sum(WasteLog.cantidad).label("total_waste"))
        .where(WasteLog.company_id == company_id, WasteLog.area == "verduleria")
        .group_by(WasteLog.producto_id)
    )
    waste_map = {str(row.producto_id): float(row.total_waste or 0) for row in waste_q.all()}

    created = 0
    for (prov_id, prod_id), entry in by_supplier_product.items():
        avg_quality = entry["sum_quality"] / Decimal(max(entry["count"], 1))
        merma_pct = Decimal(str(waste_map.get(prod_id, 0))) / max(entry["total"], Decimal("1")) * 100
        avg_price = Decimal(str(sum(entry["costs"]) / max(len(entry["costs"]), 1))) if entry["costs"] else None

        # Score: quality (0-40) + merma (0-30) + rejects (0-30)
        quality_score = float(avg_quality) / 5 * 40
        merma_score = max(0, 30 - float(merma_pct) * 2)
        reject_score = max(0, 30 - entry["rejects"] * 10)
        total_score = min(100, quality_score + merma_score + reject_score)

        if total_score >= 80:
            rec = "preferido"
        elif total_score >= 50:
            rec = "condicional"
        else:
            rec = "evitar"

        qual_label = "premium" if float(avg_quality) >= 4 else "estandar" if float(avg_quality) >= 2 else "descuento"

        existing = await db.execute(
            select(SupplierScorecard).where(
                SupplierScorecard.company_id == company_id,
                SupplierScorecard.proveedor_id == prov_id,
                SupplierScorecard.producto_id == prod_id,
            )
        )
        card = existing.scalar_one_or_none()
        if card:
            card.total_recibido = entry["total"]
            card.calidad_promedio = qual_label
            card.merma_porcentaje = merma_pct
            card.rechazos = entry["rejects"]
            card.total_entregas = entry["count"]
            card.precio_promedio = avg_price
            card.puntaje_general = Decimal(str(total_score)).quantize(Decimal("0.1"))
            card.recomendacion = rec
            card.periodo_fin = quarter_end
        else:
            card = SupplierScorecard(
                company_id=company_id,
                proveedor_id=prov_id,
                producto_id=prod_id,
                total_recibido=entry["total"],
                calidad_promedio=qual_label,
                merma_porcentaje=merma_pct,
                rechazos=entry["rejects"],
                total_entregas=entry["count"],
                precio_promedio=avg_price,
                puntaje_general=Decimal(str(total_score)).quantize(Decimal("0.1")),
                recomendacion=rec,
                periodo_inicio=quarter_start,
                periodo_fin=quarter_end,
            )
            db.add(card)
        created += 1

    await db.commit()
    return {"scorecards_actualizados": created, "periodo": f"{quarter_start} - {quarter_end}"}


# ═══════════════════════════════════════════════════════════════
# MARKDOWN POR LOTE (TRIAGE ROOM)
# ═══════════════════════════════════════════════════════════════

async def auto_apply_markdown_by_batch(db: AsyncSession, company_id: str, data) -> dict:
    """Apply markdowns per receive batch based on days to expiry."""
    today = date.today()
    r = await db.execute(
        select(ReceiveBatch).where(
            ReceiveBatch.company_id == company_id,
            ReceiveBatch.fecha_vencimiento_estimada.isnot(None),
        )
    )
    batches = r.scalars().all()
    applied = 0
    total_dto = Decimal("0")
    products_affected = []

    for b in batches:
        if not b.fecha_vencimiento_estimada:
            continue
        remaining = (b.fecha_vencimiento_estimada - today).days
        dto = None
        if remaining <= data.dias_umbral_rojo:
            dto = Decimal("50")
        elif remaining <= data.dias_umbral_amarillo:
            dto = Decimal("20")

        if dto is None:
            continue

        prod_r = await db.execute(select(Product).where(Product.id == b.producto_id))
        p = prod_r.scalar_one_or_none()
        if not p or not p.precio_venta or p.precio_venta <= 0:
            continue

        original = p.precio_venta
        markdown = (original * (1 - dto / 100)).quantize(Decimal("0"))

        ml = MarkdownLog(
            company_id=company_id,
            producto_id=b.producto_id,
            receive_batch_id=b.id,
            descuento_porcentaje=dto,
            precio_original=original,
            precio_markdown=markdown,
            motivo=f"Auto-markdown por vencimiento ({remaining}d restantes)",
        )
        db.add(ml)
        applied += 1
        total_dto += dto
        prod_name = await _get_product_name(db, b.producto_id)
        products_affected.append({
            "producto_id": str(b.producto_id),
            "producto_nombre": prod_name,
            "dias_restantes": remaining,
            "descuento": float(dto),
        })

    await db.commit()
    avg_dto = (total_dto / Decimal(max(applied, 1))).quantize(Decimal("0.1"))
    return {
        "markdowns_aplicados": applied,
        "total_descuento_promedio": avg_dto,
        "productos": products_affected,
    }


# ═══════════════════════════════════════════════════════════════
# FORECAST ENHANCED (CON ESTACIONALIDAD)
# ═══════════════════════════════════════════════════════════════

async def generate_enhanced_forecast(db: AsyncSession, company_id: str, data: ForecastEnhanceInput) -> dict:
    """Generate forecasts with seasonality: same week last year + recent trend."""
    from collections import defaultdict
    from datetime import timedelta

    q_products = select(Product).where(Product.company_id == company_id)
    if data.producto_ids:
        q_products = q_products.where(Product.id.in_(data.producto_ids))
    r = await db.execute(q_products)
    products = r.scalars().all()

    today = date.today()
    # Target next N days
    target_start = today + timedelta(days=1)
    target_end = today + timedelta(days=data.periodo_dias)
    same_week_last_year_start = target_start - timedelta(weeks=52)
    same_week_last_year_end = target_end - timedelta(weeks=52)

    created = 0

    for p in products:
        # Get sales from same week last year (simplified: from PurchaseForecast data)
        last_year_q = await db.execute(
            select(PurchaseForecast)
            .where(
                PurchaseForecast.company_id == company_id,
                PurchaseForecast.producto_id == p.id,
                PurchaseForecast.fecha_pronosticada >= same_week_last_year_start,
                PurchaseForecast.fecha_pronosticada <= same_week_last_year_end,
            )
        )
        last_year = {str(r.fecha_pronosticada): float(r.cantidad_pronosticada) for r in last_year_q.scalars().all()}

        # Get recent waste ratio for this product
        waste_q = await db.execute(
            select(sa_func.coalesce(sa_func.sum(WasteLog.cantidad), 0))
            .where(
                WasteLog.company_id == company_id,
                WasteLog.producto_id == p.id,
                WasteLog.area == "verduleria",
                WasteLog.fecha >= today - timedelta(days=30),
            )
        )
        waste_total = float(waste_q.scalar() or 0)

        # Get recent receive qtys
        receive_q = await db.execute(
            select(sa_func.coalesce(sa_func.sum(ReceiveBatch.cantidad_aceptada), 0))
            .where(
                ReceiveBatch.company_id == company_id,
                ReceiveBatch.producto_id == p.id,
                ReceiveBatch.fecha_recepcion >= today - timedelta(days=30),
            )
        )
        receive_total = float(receive_q.scalar() or 0)
        waste_ratio = min(1.0, waste_total / max(receive_total, 1))

        # Calculate seasonal factor from stock movement
        now = datetime.utcnow()
        cur = target_start
        while cur <= target_end:
            # Base: historical average from last year
            ly_key = str(cur)
            base_qty = Decimal(str(last_year.get(ly_key, 0)))
            if base_qty <= 0:
                base_qty = Decimal("10")  # minimum default

            # Apply waste adjustment
            adjusted = base_qty * (Decimal("1") + Decimal(str(waste_ratio)))
            # Seasonal factor: same month last year
            seasonal = Decimal("1.0")

            forecast = PurchaseForecast(
                company_id=company_id,
                producto_id=p.id,
                fecha_pronosticada=cur,
                cantidad_pronosticada=adjusted.quantize(Decimal("0.001")),
                periodo_used=data.periodo_dias,
                estacionalidad_factor=seasonal,
                venta_semana_anterior=Decimal(str(receive_total)),
                venta_misma_semana_anio_anterior=base_qty,
                fecha_generacion=now,
            )
            db.add(forecast)
            created += 1
            cur += timedelta(days=1)

    await db.commit()
    return {"forecasts_generados": created, "periodo_dias": data.periodo_dias, "productos": len(products)}


async def get_produce_dashboard(db: AsyncSession, company_id: str) -> dict:
    """Dashboard stats specific to verdulería."""
    today = date.today()

    r = await db.execute(
        select(sa_func.count(ReceiveBatch.id))
        .where(ReceiveBatch.company_id == company_id, ReceiveBatch.fecha_recepcion == today)
    )
    recepciones_hoy = r.scalar() or 0

    r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(ReceiveBatch.cantidad_recibida), 0))
        .where(ReceiveBatch.company_id == company_id, ReceiveBatch.fecha_recepcion == today)
    )
    kg_recibidos_hoy = float(r.scalar() or 0)

    r = await db.execute(
        select(sa_func.count(FreshnessAudit.id))
        .where(
            FreshnessAudit.company_id == company_id,
            sa_func.date(FreshnessAudit.audited_at) == today,
        )
    )
    auditorias_hoy = r.scalar() or 0

    r = await db.execute(
        select(sa_func.count())
        .select_from(ReceiveBatch)
        .where(
            ReceiveBatch.company_id == company_id,
            ReceiveBatch.calidad == ReceiveQualityGrade.rechazado,
            ReceiveBatch.fecha_recepcion >= today.replace(day=1),
        )
    )
    rechazos_mes = r.scalar() or 0

    r = await db.execute(
        select(SupplierScorecard).where(
            SupplierScorecard.company_id == company_id,
            SupplierScorecard.recomendacion == "evitar",
        )
    )
    proveedores_riesgo = len(r.scalars().all() or [])

    r = await db.execute(
        select(sa_func.count(ReceiveBatch.id))
        .where(
            ReceiveBatch.company_id == company_id,
            ReceiveBatch.fecha_vencimiento_estimada.isnot(None),
            ReceiveBatch.fecha_vencimiento_estimada <= today + timedelta(days=2),
            ReceiveBatch.calidad != ReceiveQualityGrade.rechazado,
        )
    )
    por_vencer_48h = r.scalar() or 0

    return {
        "recepciones_hoy": recepciones_hoy,
        "kg_recibidos_hoy": kg_recibidos_hoy,
        "auditorias_hoy": auditorias_hoy,
        "rechazos_mes": rechazos_mes,
        "proveedores_en_riesgo": proveedores_riesgo,
        "lotes_por_vencer_48h": por_vencer_48h,
    }
