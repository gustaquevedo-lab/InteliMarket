from sqlalchemy import select, func as sa_func, and_, desc, delete, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid, math, statistics
from collections import defaultdict, Counter

from api.src.comerciales.models import Opportunity, ProductAffinity, Recommendation, ChurnAnalysis
from api.src.customers.models import Partner
from api.src.sales.models import Sale, SaleItem
from api.src.products.models import Product
from api.src.variants.models import ProductVariant


async def _get_products(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(Product).where(Product.company_id == company_id)
    )
    return {str(p.id): {"id": str(p.id), "nombre": p.nombre, "precio": float(p.precio_venta or 0), "unidad": p.unidad_medida} for p in result.scalars().all()}


async def _get_customers(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(Partner).where(Partner.company_id == company_id)
    )
    return {str(c.id): {"id": str(c.id), "nombre": c.razon_social or c.nombre_fantasia or str(c.id)[:8], "credito_limite": float(c.credito_limite or 0), "credito_usado": float(c.credito_usado or 0)} for c in result.scalars().all()}


async def _get_sales_data(db: AsyncSession, company_id: str, months_back: int = 12) -> tuple:
    cutoff = datetime.now(timezone.utc) - timedelta(days=months_back * 30)
    result = await db.execute(
        select(Sale).where(
            Sale.company_id == company_id,
            Sale.fecha >= cutoff,
            Sale.estado.in_(["pagado", "pendiente", "completado"]),
        ).order_by(Sale.fecha)
    )
    sales = result.scalars().all()
    return sales


async def _get_sale_items_for_sales(db: AsyncSession, sale_ids: list) -> dict:
    if not sale_ids:
        return {}
    result = await db.execute(
        select(SaleItem).where(SaleItem.sale_id.in_(sale_ids))
    )
    items = result.scalars().all()
    by_sale = defaultdict(list)
    for item in items:
        by_sale[str(item.sale_id)].append({
            "product_id": str(item.product_id),
            "variant_id": str(item.variant_id) if item.variant_id else None,
            "cantidad": float(item.cantidad or 0),
            "precio": float(item.precio_unitario or 0),
        })
    return dict(by_sale)


async def _generate_opportunity(db: AsyncSession, company_id: str, data: dict) -> dict:
    existing = await db.execute(
        select(Opportunity).where(
            Opportunity.company_id == company_id,
            Opportunity.customer_id == data["customer_id"],
            Opportunity.opportunity_type == data["opportunity_type"],
            Opportunity.product_id == data.get("product_id"),
            Opportunity.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        return None

    opp = Opportunity(
        company_id=company_id,
        customer_id=data["customer_id"],
        product_id=data.get("product_id"),
        suggested_product_id=data.get("suggested_product_id"),
        opportunity_type=data["opportunity_type"],
        title=data["title"],
        description=data.get("description"),
        priority=data.get("priority", "medium"),
        score=data.get("score", 0),
        status="pending",
        suggested_discount_pct=data.get("suggested_discount_pct"),
        suggested_action=data.get("suggested_action"),
        metadata_json=data.get("metadata"),
    )
    db.add(opp)
    await db.flush()
    return {
        "id": str(opp.id),
        "customer_id": str(opp.customer_id),
        "opportunity_type": opp.opportunity_type,
        "title": opp.title,
        "priority": opp.priority,
        "score": opp.score,
    }


# ===== CHURN DETECTION =====

async def detect_churn(db: AsyncSession, company_id: str) -> list[dict]:
    sales = await _get_sales_data(db, company_id, 12)
    customers = await _get_customers(db, company_id)
    now = datetime.now(timezone.utc)

    customer_sales = defaultdict(list)
    for s in sales:
        customer_sales[str(s.customer_id)].append(s)

    opportunities = []
    for cid, cdata in customers.items():
        csales = customer_sales.get(cid, [])
        if len(csales) < 2:
            continue

        last_date = csales[-1].fecha
        days_since = (now - last_date.replace(tzinfo=timezone.utc)).days

        if days_since < 30:
            continue

        dates = [s.fecha for s in csales]
        intervals = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
        avg_interval = statistics.mean(intervals) if intervals else 30

        recent_dates = [d for d in dates if (now - d.replace(tzinfo=timezone.utc)).days <= 90]
        recent_freq = len(recent_dates) / 3 if len(recent_dates) >= 3 else len(recent_dates) / max(1, (now - min(dates).replace(tzinfo=timezone.utc)).days / 30)
        past_freq = len(csales) / 12

        churn_score = min(100, int(days_since / max(avg_interval, 1) * 50))
        if past_freq > 0 and recent_freq < past_freq * 0.5:
            churn_score = min(100, churn_score + 30)

        risk = "low"
        if churn_score >= 80: risk = "critical"
        elif churn_score >= 60: risk = "high"
        elif churn_score >= 40: risk = "medium"

        analysis = ChurnAnalysis(
            company_id=company_id,
            customer_id=cid,
            churn_score=churn_score,
            churn_risk=risk,
            days_since_last_purchase=days_since,
            previous_frequency_days=avg_interval,
            current_frequency_days=recent_freq,
            frequency_drop_pct=max(0, (past_freq - recent_freq) / max(past_freq, 1) * 100),
            average_purchase_amount=sum(float(s.total or 0) for s in csales) / len(csales),
        )
        db.add(analysis)

        opp = await _generate_opportunity(db, company_id, {
            "customer_id": cid,
            "opportunity_type": "churn",
            "title": f"Cliente sin compras hace {days_since} días",
            "description": f"Riesgo {risk}. Frecuencia previa: cada {avg_interval:.0f}d, actual: {recent_freq:.1f}/mes. Dejó de comprar hace {days_since} días.",
            "priority": "high" if risk in ("high", "critical") else "medium",
            "score": churn_score,
            "suggested_action": "Contactar vendedor para retención",
            "metadata": {"churn_risk": risk, "days_since": days_since, "avg_interval": avg_interval},
        })
        if opp:
            opportunities.append(opp)

    await db.commit()
    return opportunities


# ===== DORMANT PRODUCTS =====

async def detect_dormant_products(db: AsyncSession, company_id: str) -> list[dict]:
    sales = await _get_sales_data(db, company_id, 12)
    sale_ids = [s.id for s in sales]
    items_by_sale = await _get_sale_items_for_sales(db, sale_ids)
    products = await _get_products(db, company_id)
    now = datetime.now(timezone.utc)

    customer_product_dates = defaultdict(lambda: defaultdict(list))
    for s in sales:
        cid = str(s.customer_id)
        sdate = s.fecha
        items = items_by_sale.get(str(s.id), [])
        for item in items:
            customer_product_dates[cid][item["product_id"]].append(sdate)

    opportunities = []
    for cid, prods in customer_product_dates.items():
        for pid, dates in prods.items():
            last_date = max(dates)
            days_since = (now - last_date.replace(tzinfo=timezone.utc)).days

            if days_since < 60:
                continue

            past_6m = [d for d in dates if (now - d.replace(tzinfo=timezone.utc)).days <= 180]
            if len(past_6m) < 2:
                continue

            score = min(100, int(days_since / 90 * 100))
            pname = products.get(pid, {}).get("nombre", pid[:8])

            opp = await _generate_opportunity(db, company_id, {
                "customer_id": cid,
                "product_id": pid,
                "opportunity_type": "dormant_product",
                "title": f"Producto inactivo: {pname}",
                "description": f"Cliente compraba {pname} ({len(past_6m)} veces en 6 meses) pero no desde hace {days_since} días. Sugerir descuento de reenganche.",
                "priority": "medium" if score < 60 else "high",
                "score": score,
                "suggested_discount_pct": min(20, 5 + int(days_since / 30) * 2),
                "suggested_action": "Ofrecer descuento",
                "metadata": {"days_since": days_since, "previous_count": len(past_6m)},
            })
            if opp:
                opportunities.append(opp)

    await db.commit()
    return opportunities


# ===== CROSS-SELLING / PRODUCT AFFINITY =====

async def compute_affinity(db: AsyncSession, company_id: str) -> dict:
    sales = await _get_sales_data(db, company_id, 6)
    sale_ids = [s.id for s in sales]
    items_by_sale = await _get_sale_items_for_sales(db, sale_ids)

    total_transactions = len(sale_ids)
    product_counts = Counter()
    pair_counts = Counter()

    for sid, items in items_by_sale.items():
        pids = sorted(set(item["product_id"] for item in items))
        for pid in pids:
            product_counts[pid] += 1
        for i in range(len(pids)):
            for j in range(i+1, len(pids)):
                pair_counts[(pids[i], pids[j])] += 1

    await db.execute(
        delete(ProductAffinity).where(ProductAffinity.company_id == company_id)
    )

    count = 0
    for (a, b), times in pair_counts.most_common(2000):
        support = times / total_transactions
        conf_a = times / product_counts[a]
        conf_b = times / product_counts[b]
        lift_a = conf_a / (product_counts[b] / total_transactions) if product_counts[b] > 0 else 0

        if lift_a < 1.0:
            continue

        for pa, pb, conf in [(a, b, conf_a), (b, a, conf_b)]:
            affinity = ProductAffinity(
                company_id=company_id,
                product_a_id=pa,
                product_b_id=pb,
                support=round(support, 6),
                confidence=round(conf, 6),
                lift=round(lift_a, 4),
                times_bought_together=times,
            )
            db.add(affinity)
            count += 1

    await db.commit()
    return {"affinity_rules_computed": count, "total_transactions": total_transactions}


async def get_product_affinity(db: AsyncSession, company_id: str, product_id: str, limit: int = 10) -> list[dict]:
    result = await db.execute(
        select(ProductAffinity).where(
            ProductAffinity.company_id == company_id,
            ProductAffinity.product_a_id == product_id,
        ).order_by(desc(ProductAffinity.lift)).limit(limit)
    )
    rows = result.scalars().all()
    products = await _get_products(db, company_id)
    return [
        {
            "product_id": r.product_b_id,
            "product_name": products.get(str(r.product_b_id), {}).get("nombre", ""),
            "confidence": r.confidence,
            "lift": r.lift,
            "support": r.support,
            "times_bought_together": r.times_bought_together,
        }
        for r in rows
    ]


async def generate_cross_sell_opportunities(db: AsyncSession, company_id: str) -> list[dict]:
    sales = await _get_sales_data(db, company_id, 3)
    sale_ids = [s.id for s in sales]
    items_by_sale = await _get_sale_items_for_sales(db, sale_ids)
    products = await _get_products(db, company_id)

    result = await db.execute(
        select(ProductAffinity).where(ProductAffinity.company_id == company_id, ProductAffinity.lift >= 1.5)
        .order_by(desc(ProductAffinity.lift)).limit(100)
    )
    rules = result.scalars().all()
    rule_map = defaultdict(list)
    for r in rules:
        rule_map[str(r.product_a_id)].append({
            "product_b": str(r.product_b_id),
            "confidence": r.confidence,
            "lift": r.lift,
        })

    opportunities = []
    for s in sales:
        cid = str(s.customer_id)
        items = items_by_sale.get(str(s.id), [])
        bought = set(item["product_id"] for item in items)

        for item in items:
            pid = item["product_id"]
            for suggestion in rule_map.get(pid, []):
                sb = suggestion["product_b"]
                if sb in bought:
                    continue
                pname = products.get(sb, {}).get("nombre", sb[:8])
                opp = await _generate_opportunity(db, company_id, {
                    "customer_id": cid,
                    "product_id": pid,
                    "suggested_product_id": sb,
                    "opportunity_type": "cross_sell",
                    "title": f"Venta cruzada: {pname}",
                    "description": f"Clientes que compraron {products.get(pid, {}).get('nombre', pid[:8])} también compraron {pname} (confianza {suggestion['confidence']:.0%})",
                    "priority": "high" if suggestion["confidence"] > 0.3 else "medium",
                    "score": min(100, int(suggestion["confidence"] * 100)),
                    "suggested_action": "Sugerir en pedido",
                    "metadata": {"confidence": suggestion["confidence"], "lift": suggestion["lift"]},
                })
                if opp:
                    opportunities.append(opp)
                    break
            if opportunities and len([o for o in opportunities if o["customer_id"] == cid]) > 5:
                break

    await db.commit()
    return opportunities


# ===== CREDIT POTENTIAL =====

async def detect_credit_potential(db: AsyncSession, company_id: str) -> list[dict]:
    sales = await _get_sales_data(db, company_id, 6)
    customers = await _get_customers(db, company_id)
    now = datetime.now(timezone.utc)

    cash_customers = defaultdict(lambda: {"count": 0, "total": 0, "last": None})
    for s in sales:
        cid = str(s.customer_id)
        if s.condicion == "contado":
            cash_customers[cid]["count"] += 1
            cash_customers[cid]["total"] += float(s.total or 0)
            cash_customers[cid]["last"] = s.fecha

    opportunities = []
    for cid, cdata in cash_customers.items():
        if cdata["count"] < 3:
            continue
        cust = customers.get(cid)
        if not cust:
            continue

        has_credit = cust["credito_limite"] > 0
        credit_used = cust["credito_usado"]
        avg_purchase = cdata["total"] / cdata["count"]

        if not has_credit and avg_purchase > 100000:
            opp = await _generate_opportunity(db, company_id, {
                "customer_id": cid,
                "opportunity_type": "credit_potential",
                "title": f"Cliente paga en efectivo — potencial crédito",
                "description": f"Compra promedio Gs {avg_purchase:,.0f} ({cdata['count']} veces en 6 meses, todo efectivo). Califica para línea de crédito.",
                "priority": "high" if avg_purchase > 1000000 else "medium",
                "score": min(100, int(avg_purchase / 100000)),
                "suggested_action": "Ofrecer línea de crédito",
                "metadata": {"avg_purchase": avg_purchase, "cash_purchases": cdata["count"], "suggested_limit": int(avg_purchase * 2)},
            })
            if opp:
                opportunities.append(opp)

        elif has_credit and credit_used == 0 and avg_purchase > 100000:
            opp = await _generate_opportunity(db, company_id, {
                "customer_id": cid,
                "opportunity_type": "credit_potential",
                "title": f"Cliente con crédito disponible sin usar",
                "description": f"Tiene línea de Gs {cust['credito_limite']:,.0f} sin usar. Compra promedio Gs {avg_purchase:,.0f} en efectivo.",
                "priority": "medium",
                "score": 60,
                "suggested_action": "Recordar línea de crédito disponible",
                "metadata": {"credit_limit": cust["credito_limite"], "avg_purchase": avg_purchase},
            })
            if opp:
                opportunities.append(opp)

    await db.commit()
    return opportunities


# ===== UP-SELLING =====

async def detect_up_sell_opportunities(db: AsyncSession, company_id: str) -> list[dict]:
    sales = await _get_sales_data(db, company_id, 6)
    sale_ids = [s.id for s in sales]
    items_by_sale = await _get_sale_items_for_sales(db, sale_ids)
    products = await _get_products(db, company_id)

    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.tipo == "presentacion"
        )
    )
    variants = result.scalars().all()

    product_variants = defaultdict(list)
    for v in variants:
        product_variants[str(v.product_id)].append({
            "id": str(v.id),
            "valor": v.valor,
            "precio_extra": float(v.precio_extra or 0),
        })

    customer_product_counts = defaultdict(lambda: defaultdict(lambda: {"count": 0, "total": 0, "last": None}))
    for s in sales:
        cid = str(s.customer_id)
        items = items_by_sale.get(str(s.id), [])
        for item in items:
            key = f"{item['product_id']}:{item['variant_id'] or 'base'}"
            customer_product_counts[cid][key]["count"] += 1
            customer_product_counts[cid][key]["total"] += item["cantidad"]
            customer_product_counts[cid][key]["last"] = s.fecha

    opportunities = []
    now = datetime.now(timezone.utc)

    for cid, prods in customer_product_counts.items():
        for key, data in prods.items():
            pid, vid = key.split(":") if ":" in key else (key, None)

            if data["count"] < 3 or data["total"] < 3:
                continue

            variants_list = product_variants.get(pid, [])
            if not variants_list:
                continue

            suggestion = variants_list[0]
            pname = products.get(pid, {}).get("nombre", pid[:8])

            opp = await _generate_opportunity(db, company_id, {
                "customer_id": cid,
                "product_id": pid,
                "suggested_product_id": suggestion["id"],
                "opportunity_type": "up_sell",
                "title": f"Up-sell: {pname} — probar {suggestion['valor']}",
                "description": f"Cliente compró {pname} {data['count']} veces. Sugerir presentación {suggestion['valor']} (+Gs {suggestion['precio_extra']:,.0f})",
                "priority": "medium",
                "score": min(100, data["count"] * 15),
                "suggested_action": "Sugerir presentación mayor",
                "metadata": {"current_variant": vid, "suggested_variant": suggestion["id"], "times_bought": data["count"]},
            })
            if opp:
                opportunities.append(opp)

    await db.commit()
    return opportunities


# ===== DETECT ALL =====

async def detect_all(db: AsyncSession, company_id: str) -> dict:
    churn = await detect_churn(db, company_id)
    dormant = await detect_dormant_products(db, company_id)
    cross = await generate_cross_sell_opportunities(db, company_id)
    credit = await detect_credit_potential(db, company_id)
    upsell = await detect_up_sell_opportunities(db, company_id)
    return {
        "churn": len(churn),
        "dormant_products": len(dormant),
        "cross_sell": len(cross),
        "credit_potential": len(credit),
        "up_sell": len(upsell),
        "total": len(churn) + len(dormant) + len(cross) + len(credit) + len(upsell),
    }


async def list_opportunities(
    db: AsyncSession, company_id: str,
    opportunity_type: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 100, offset: int = 0,
) -> list[dict]:
    conditions = [Opportunity.company_id == company_id]
    if opportunity_type:
        conditions.append(Opportunity.opportunity_type == opportunity_type)
    if status:
        conditions.append(Opportunity.status == status)
    if priority:
        conditions.append(Opportunity.priority == priority)

    result = await db.execute(
        select(Opportunity).where(and_(*conditions))
        .order_by(desc(Opportunity.score), desc(Opportunity.created_at))
        .limit(limit).offset(offset)
    )
    opps = result.scalars().all()
    return [
        {
            "id": str(o.id),
            "customer_id": str(o.customer_id),
            "product_id": str(o.product_id) if o.product_id else None,
            "suggested_product_id": str(o.suggested_product_id) if o.suggested_product_id else None,
            "opportunity_type": o.opportunity_type,
            "title": o.title,
            "description": o.description,
            "priority": o.priority,
            "score": o.score,
            "status": o.status,
            "suggested_discount_pct": float(o.suggested_discount_pct) if o.suggested_discount_pct else None,
            "suggested_action": o.suggested_action,
            "assigned_to": str(o.assigned_to) if o.assigned_to else None,
            "resolved_at": o.resolved_at,
            "created_at": o.created_at,
        }
        for o in opps
    ]


async def update_opportunity(db: AsyncSession, company_id: str, opp_id: str, status: str) -> Optional[dict]:
    result = await db.execute(
        select(Opportunity).where(Opportunity.id == opp_id, Opportunity.company_id == company_id)
    )
    opp = result.scalar_one_or_none()
    if not opp:
        return None
    opp.status = status
    if status in ("converted", "dismissed"):
        opp.resolved_at = datetime.now(timezone.utc)
    db.add(opp)
    await db.commit()
    return {"status": "updated", "new_status": status}


async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(Opportunity).where(Opportunity.company_id == company_id)
    )
    all_opps = result.scalars().all()

    by_type = defaultdict(int)
    by_priority = defaultdict(int)
    pending = 0
    recent = []

    for o in all_opps:
        by_type[o.opportunity_type] += 1
        by_priority[o.priority] += 1
        if o.status == "pending":
            pending += 1
        if len(recent) < 10:
            recent.append({
                "id": str(o.id),
                "customer_id": str(o.customer_id),
                "opportunity_type": o.opportunity_type,
                "title": o.title,
                "priority": o.priority,
                "score": o.score,
                "status": o.status,
                "created_at": o.created_at,
            })

    total = len(all_opps)
    summary = {
        "opportunities_found": total,
        "churn_detected": by_type.get("churn", 0),
        "dormant_products_found": by_type.get("dormant_product", 0),
        "cross_sell_suggestions": by_type.get("cross_sell", 0),
        "credit_potential_found": by_type.get("credit_potential", 0),
        "up_sell_found": by_type.get("up_sell", 0),
        "high_priority": by_priority.get("high", 0) + by_priority.get("critical", 0),
    }

    return {
        "summary": summary,
        "by_type": [{"type": k, "count": v} for k, v in by_type.items()],
        "by_priority": [{"priority": k, "count": v} for k, v in by_priority.items()],
        "recent_opportunities": recent,
        "pending_count": pending,
    }
