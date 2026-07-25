from decimal import Decimal
from datetime import datetime, timezone, date, timedelta
from typing import Any
import uuid

from sqlalchemy import select, text, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.commercial_agreements.models import (
    CommercialAgreement, AgreementItem, AgreementRebate, AgreementVolume, SupplierNegotiation,
)
from api.src.commercial_agreements.schemas import (
    AgreementCreate, AgreementUpdate, AgreementItemInput,
    SupplierNegotiationCreate, SupplierNegotiationUpdate,
)


async def generate_agreement_number(db: AsyncSession, company_id: str) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(CommercialAgreement)
        .where(CommercialAgreement.company_id == company_id)
        .order_by(CommercialAgreement.created_at.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"AC-{date_part}-{seq:06d}"


async def create_agreement(db: AsyncSession, data: AgreementCreate) -> CommercialAgreement:
    numero = await generate_agreement_number(db, str(data.company_id))

    agreement = CommercialAgreement(
        company_id=data.company_id,
        supplier_id=data.supplier_id,
        numero=numero,
        nombre=data.nombre,
        tipo=data.tipo,
        estado="borrador",
        prioridad=data.prioridad,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        dias_aviso_renovacion=data.dias_aviso_renovacion or 30,
        condiciones_pago=data.condiciones_pago,
        plazo_pago_dias=data.plazo_pago_dias or 30,
        moneda=data.moneda or "PYG",
        tipo_cambio_fijo=data.tipo_cambio_fijo,
        forma_pago=data.forma_pago,
        aplica_iragru=data.aplica_iragru or False,
        tasa_iragru=data.tasa_iragru,
        aplica_retencion_iva=data.aplica_retencion_iva or False,
        tasa_retencion_iva=data.tasa_retencion_iva,
        categoria_retencion=data.categoria_retencion,
        exclusividad=data.exclusividad or False,
        zona_exclusividad=data.zona_exclusividad,
        tipo_envio=data.tipo_envio,
        porto_destino=data.porto_destino,
        monto_minimo_orden=data.monto_minimo_orden,
        monto_maximo_orden=data.monto_maximo_orden,
        monto_total_acordado=data.monto_total_acordado,
        monto_ejecutado=Decimal("0"),
        volumen_minimo_mensual=data.volumen_minimo_mensual,
        unidad_medida=data.unidad_medida,
        aplica_rebate=data.aplica_rebate or False,
        tipo_rebate=data.tipo_rebate,
        umbral_rebate_1=data.umbral_rebate_1,
        porcentaje_rebate_1=data.porcentaje_rebate_1,
        umbral_rebate_2=data.umbral_rebate_2,
        porcentaje_rebate_2=data.porcentaje_rebate_2,
        umbral_rebate_3=data.umbral_rebate_3,
        porcentaje_rebate_3=data.porcentaje_rebate_3,
        frecuencia_liquidacion_rebate=data.frecuencia_liquidacion_rebate,
        multa_incumplimiento=data.multa_incumplimiento,
        bonificacion_cumplimiento=data.bonificacion_cumplimiento,
        nota_penalidad=data.nota_penalidad,
        objeto=data.objeto,
        observaciones=data.observaciones,
        user_id=data.user_id,
    )
    db.add(agreement)
    await db.flush()

    if data.items:
        for item_data in data.items:
            precio_final = item_data.precio_acordado
            if item_data.descuento_pct and item_data.precio_lista:
                descuento = Decimal(str(item_data.precio_lista)) * Decimal(str(item_data.descuento_pct)) / Decimal("100")
                precio_final = Decimal(str(item_data.precio_lista)) - descuento

            item = AgreementItem(
                agreement_id=agreement.id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                descripcion=item_data.descripcion,
                precio_acordado=precio_final,
                precio_lista=item_data.precio_lista,
                descuento_pct=item_data.descuento_pct,
                moneda=item_data.moneda,
                tipo_precio=item_data.tipo_precio,
                cantidad_minima=item_data.cantidad_minima,
                cantidad_multiple=item_data.cantidad_multiple,
                iva_tasa=item_data.iva_tasa,
                incluye_iva=item_data.incluye_iva,
                lead_time_dias=item_data.lead_time_dias,
            )
            db.add(item)

    await db.flush()
    await db.refresh(agreement)
    return agreement


async def list_agreements(
    db: AsyncSession, company_id: str, supplier_id: str | None = None,
    estado: str | None = None, vigentes: bool | None = None,
    limit: int = 50, offset: int = 0,
) -> list[CommercialAgreement]:
    query = select(CommercialAgreement).where(CommercialAgreement.company_id == company_id)
    if supplier_id:
        query = query.where(CommercialAgreement.supplier_id == supplier_id)
    if estado:
        query = query.where(CommercialAgreement.estado == estado)
    if vigentes:
        today = date.today()
        query = query.where(CommercialAgreement.fecha_inicio <= today, CommercialAgreement.fecha_fin >= today)
    query = query.order_by(CommercialAgreement.fecha_inicio.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_agreement(db: AsyncSession, agreement_id: str) -> CommercialAgreement | None:
    result = await db.execute(
        select(CommercialAgreement).where(CommercialAgreement.id == uuid.UUID(agreement_id))
    )
    return result.scalar_one_or_none()


async def get_agreement_with_items(db: AsyncSession, agreement_id: str) -> dict | None:
    agreement = await get_agreement(db, agreement_id)
    if not agreement:
        return None
    items_result = await db.execute(
        select(AgreementItem).where(AgreementItem.agreement_id == agreement.id)
    )
    items = list(items_result.scalars().all())
    return {
        **{c.name: getattr(agreement, c.name) for c in agreement.__table__.columns},
        "items": items,
    }


async def update_agreement(db: AsyncSession, agreement_id: str, data: AgreementUpdate) -> CommercialAgreement | None:
    agreement = await get_agreement(db, agreement_id)
    if not agreement or agreement.estado not in ("borrador",):
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "items":
            continue
        setattr(agreement, field, value)

    if data.items is not None:
        existing = await db.execute(select(AgreementItem).where(AgreementItem.agreement_id == agreement.id))
        for item in existing.scalars().all():
            await db.delete(item)
        for item_data in data.items:
            item = AgreementItem(agreement_id=agreement.id, **item_data.model_dump())
            db.add(item)

    agreement.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(agreement)
    return agreement


async def approve_agreement(db: AsyncSession, agreement_id: str, aprobado_por: str) -> CommercialAgreement | None:
    agreement = await get_agreement(db, agreement_id)
    if not agreement or agreement.estado != "borrador":
        return None
    agreement.estado = "activo"
    agreement.aprobado_por = uuid.UUID(aprobado_por) if isinstance(aprobado_por, str) else aprobado_por
    agreement.fecha_aprobacion = datetime.now(timezone.utc)
    agreement.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(agreement)
    return agreement


async def activate_agreement(db: AsyncSession, agreement_id: str) -> CommercialAgreement | None:
    agreement = await get_agreement(db, agreement_id)
    if not agreement or agreement.estado != "borrador":
        return None
    agreement.estado = "activo"
    agreement.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(agreement)
    return agreement


async def cancel_agreement(db: AsyncSession, agreement_id: str, motivo: str | None = None) -> CommercialAgreement | None:
    agreement = await get_agreement(db, agreement_id)
    if not agreement or agreement.estado in ("cancelado", "vencido"):
        return None
    agreement.estado = "cancelado"
    if motivo:
        agreement.observaciones = (agreement.observaciones or "") + f"\nCancelación: {motivo}"
    agreement.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(agreement)
    return agreement


async def renew_agreement(db: AsyncSession, agreement_id: str) -> dict | None:
    old = await get_agreement(db, agreement_id)
    if not old or old.estado not in ("activo", "vencido"):
        return None

    new_data = AgreementCreate(
        company_id=old.company_id,
        supplier_id=old.supplier_id,
        nombre=f"{old.nombre} (Renovación)",
        tipo=old.tipo,
        prioridad=old.prioridad,
        fecha_inicio=old.fecha_fin + timedelta(days=1),
        fecha_fin=old.fecha_fin + timedelta(days=365),
        dias_aviso_renovacion=old.dias_aviso_renovacion,
        condiciones_pago=old.condiciones_pago,
        plazo_pago_dias=old.plazo_pago_dias,
        moneda=old.moneda,
        tipo_cambio_fijo=old.tipo_cambio_fijo,
        forma_pago=old.forma_pago,
        aplica_iragru=old.aplica_iragru,
        tasa_iragru=old.tasa_iragru,
        aplica_retencion_iva=old.aplica_retencion_iva,
        tasa_retencion_iva=old.tasa_retencion_iva,
        categoria_retencion=old.categoria_retencion,
        exclusividad=old.exclusividad,
        zona_exclusividad=old.zona_exclusividad,
        tipo_envio=old.tipo_envio,
        porto_destino=old.porto_destino,
        monto_minimo_orden=old.monto_minimo_orden,
        monto_maximo_orden=old.monto_maximo_orden,
        monto_total_acordado=old.monto_total_acordado,
        aplica_rebate=old.aplica_rebate,
        tipo_rebate=old.tipo_rebate,
        umbral_rebate_1=old.umbral_rebate_1,
        porcentaje_rebate_1=old.porcentaje_rebate_1,
        umbral_rebate_2=old.umbral_rebate_2,
        porcentaje_rebate_2=old.porcentaje_rebate_2,
        umbral_rebate_3=old.umbral_rebate_3,
        porcentaje_rebate_3=old.porcentaje_rebate_3,
        frecuencia_liquidacion_rebate=old.frecuencia_liquidacion_rebate,
        multa_incumplimiento=old.multa_incumplimiento,
        bonificacion_cumplimiento=old.bonificacion_cumplimiento,
        nota_penalidad=old.nota_penalidad,
        objeto=old.objeto,
        observaciones=f"Renovación de acuerdo {old.numero}",
    )

    items_result = await db.execute(select(AgreementItem).where(AgreementItem.agreement_id == old.id))
    items = list(items_result.scalars().all())
    new_data.items = [
        AgreementItemInput(
            product_id=i.product_id, variant_id=i.variant_id, descripcion=i.descripcion,
            precio_acordado=i.precio_acordado, precio_lista=i.precio_lista, descuento_pct=i.descuento_pct,
            moneda=i.moneda, tipo_precio=i.tipo_precio, cantidad_minima=i.cantidad_minima,
            cantidad_multiple=i.cantidad_multiple, iva_tasa=i.iva_tasa, incluye_iva=i.incluye_iva,
            lead_time_dias=i.lead_time_dias,
        )
        for i in items
    ]

    new_agreement = await create_agreement(db, new_data)
    old.estado = "renovado"
    old.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return {"old": old, "new": new_agreement}


async def get_agreements_expiring(db: AsyncSession, company_id: str, dias: int = 30) -> list[dict]:
    cutoff = date.today() + timedelta(days=dias)
    result = await db.execute(
        text("""
            SELECT ca.*, s.razon_social as supplier_name
            FROM commercial_agreements ca
            LEFT JOIN suppliers s ON s.id = ca.supplier_id
            WHERE ca.company_id = :company_id
            AND ca.estado = 'activo'
            AND ca.fecha_fin <= :cutoff
            ORDER BY ca.fecha_fin ASC
        """),
        {"company_id": company_id, "cutoff": cutoff},
    )
    return [dict(row._mapping) for row in result.fetchall()]


async def calculate_execution_percentage(db: AsyncSession, agreement_id: str) -> float:
    agreement = await get_agreement(db, agreement_id)
    if not agreement or not agreement.monto_total_acordado:
        return 0.0
    return float(
        (agreement.monto_ejecutado or Decimal("0")) / agreement.monto_total_acordado * Decimal("100")
    )


async def add_agreement_item(db: AsyncSession, agreement_id: str, data: AgreementItemInput) -> AgreementItem | None:
    agreement = await get_agreement(db, agreement_id)
    if not agreement or agreement.estado != "borrador":
        return None
    item = AgreementItem(agreement_id=agreement.id, **data.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def remove_agreement_item(db: AsyncSession, item_id: str) -> bool:
    result = await db.execute(select(AgreementItem).where(AgreementItem.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        return False
    await db.delete(item)
    await db.flush()
    return True


async def calculate_rebate(
    db: AsyncSession, agreement_id: str, supplier_id: str, periodo: str,
) -> dict:
    agreement = await get_agreement(db, agreement_id)
    if not agreement or not agreement.aplica_rebate:
        return {"error": "Acuerdo no aplica rebates"}

    result = await db.execute(
        text("""
            SELECT COALESCE(SUM(total), 0) as monto_total
            FROM purchase_orders
            WHERE supplier_id = :supplier_id
            AND DATE_TRUNC('month', fecha) = :periodo
            AND estado NOT IN ('cancelado', 'borrador')
        """),
        {"supplier_id": supplier_id, "periodo": periodo},
    )
    row = result.fetchone()
    monto_total = Decimal(str(row.monto_total)) if row else Decimal("0")

    rebates = []
    for umbral, porcentaje, label in [
        (agreement.umbral_rebate_1, agreement.porcentaje_rebate_1, "rebate_1"),
        (agreement.umbral_rebate_2, agreement.porcentaje_rebate_2, "rebate_2"),
        (agreement.umbral_rebate_3, agreement.porcentaje_rebate_3, "rebate_3"),
    ]:
        if umbral and porcentaje and monto_total >= umbral:
            valor = monto_total * Decimal(str(porcentaje)) / Decimal("100")
            rebate = AgreementRebate(
                agreement_id=agreement.id,
                supplier_id=uuid.UUID(supplier_id),
                periodo=periodo,
                tipo="porcentaje",
                umbral_desde=umbral,
                valor_rebate=valor,
                monto_aplicado=Decimal("0"),
                estado="pendiente",
            )
            db.add(rebate)
            rebates.append({"umbral": float(umbral), "porcentaje": float(porcentaje), "monto_rebate": float(valor)})

    await db.flush()
    return {"monto_total": float(monto_total), "rebates": rebates}


async def liquidate_rebate(db: AsyncSession, rebate_id: str, aprobado_por: str) -> AgreementRebate | None:
    result = await db.execute(select(AgreementRebate).where(AgreementRebate.id == uuid.UUID(rebate_id)))
    rebate = result.scalar_one_or_none()
    if not rebate or rebate.estado != "pendiente":
        return None
    rebate.estado = "pagado"
    rebate.fecha_aprobacion = datetime.now(timezone.utc)
    rebate.aprobado_por = uuid.UUID(aprobado_por) if isinstance(aprobado_por, str) else aprobado_por
    await db.flush()
    await db.refresh(rebate)
    return rebate


async def get_pending_rebates(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT ar.*, s.razon_social as supplier_name, ca.numero as agreement_numero, ca.nombre as agreement_nombre
            FROM agreement_rebates ar
            JOIN commercial_agreements ca ON ca.id = ar.agreement_id
            JOIN suppliers s ON s.id = ar.supplier_id
            WHERE ca.company_id = :company_id AND ar.estado = 'pendiente'
            ORDER BY ar.created_at DESC
        """),
        {"company_id": company_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


async def update_volume_tracking(db: AsyncSession, purchase_order: Any) -> None:
    if not purchase_order.supplier_id or not purchase_order.total:
        return

    result = await db.execute(
        text("""
            SELECT ca.id, ca.volumen_minimo_mensual, ca.monto_total_acordado, av.id as volume_id
            FROM commercial_agreements ca
            LEFT JOIN agreement_volumes av ON av.agreement_id = ca.id
                AND av.periodo = DATE_TRUNC('month', NOW())::text
            WHERE ca.supplier_id = :supplier_id
            AND ca.estado = 'activo'
            AND ca.fecha_inicio <= CURRENT_DATE
            AND ca.fecha_fin >= CURRENT_DATE
            LIMIT 1
        """),
        {"supplier_id": str(purchase_order.supplier_id)},
    )
    row = result.fetchone()
    if not row:
        return

    month_key = datetime.now(timezone.utc).strftime("%Y-%m")

    if row.volume_id:
        await db.execute(
            text("""
                UPDATE agreement_volumes
                SET volumen_real = volumen_real + :qty,
                    monto_real = monto_real + :total,
                    porcentaje_cumplimiento = CASE WHEN monto_comprometido > 0 THEN (monto_real + :total) / monto_comprometido * 100 ELSE 0 END
                WHERE id = :vid
            """),
            {"qty": float(purchase_order.total), "total": float(purchase_order.total), "vid": str(row.volume_id)},
        )
    else:
        vol = AgreementVolume(
            agreement_id=row.id,
            supplier_id=purchase_order.supplier_id,
            periodo=month_key,
            tipo_periodo="mensual",
            volumen_comprometido=row.volumen_minimo_mensual or Decimal("0"),
            volumen_real=purchase_order.total,
            monto_comprometido=row.monto_total_acordado or Decimal("0"),
            monto_real=purchase_order.total,
            estado="abierto",
        )
        db.add(vol)

    await db.execute(
        text("""
            UPDATE commercial_agreements
            SET monto_ejecutado = monto_ejecutado + :total
            WHERE id = :aid
        """),
        {"total": float(purchase_order.total), "aid": str(row.id)},
    )
    await db.flush()


async def create_negotiation(db: AsyncSession, data: SupplierNegotiationCreate) -> SupplierNegotiation:
    neg = SupplierNegotiation(**data.model_dump())
    db.add(neg)
    await db.flush()
    await db.refresh(neg)
    return neg


async def list_negotiations(
    db: AsyncSession, company_id: str, supplier_id: str | None = None, estado: str | None = None,
) -> list[SupplierNegotiation]:
    query = select(SupplierNegotiation).where(SupplierNegotiation.company_id == company_id)
    if supplier_id:
        query = query.where(SupplierNegotiation.supplier_id == supplier_id)
    if estado:
        query = query.where(SupplierNegotiation.estado == estado)
    query = query.order_by(SupplierNegotiation.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def close_negotiation(
    db: AsyncSession, negotiation_id: str, precio_final: Decimal | None, estado: str,
) -> SupplierNegotiation | None:
    result = await db.execute(
        select(SupplierNegotiation).where(SupplierNegotiation.id == uuid.UUID(negotiation_id))
    )
    neg = result.scalar_one_or_none()
    if not neg or neg.estado not in ("abierta", "en_negociacion"):
        return None
    neg.estado = estado
    if precio_final:
        neg.precio_final = precio_final
    neg.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(neg)
    return neg


async def get_supplier_commercial_summary(db: AsyncSession, supplier_id: str) -> dict:
    today = date.today()

    active = await db.execute(
        text("""
            SELECT COUNT(*) as total, COALESCE(SUM(monto_total_acordado), 0) as monto_total,
                   COALESCE(SUM(monto_ejecutado), 0) as monto_ejecutado
            FROM commercial_agreements
            WHERE supplier_id = :sid AND estado = 'activo' AND fecha_inicio <= :today AND fecha_fin >= :today
        """),
        {"sid": supplier_id, "today": today},
    )
    arow = active.fetchone()

    pending_rebates = await db.execute(
        text("SELECT COUNT(*) as total, COALESCE(SUM(valor_rebate), 0) as monto FROM agreement_rebates WHERE supplier_id = :sid AND estado = 'pendiente'"),
        {"sid": supplier_id},
    )
    prow = pending_rebates.fetchone()

    avg_compliance = await db.execute(
        text("SELECT AVG(porcentaje_cumplimiento) as avg FROM agreement_volumes av JOIN commercial_agreements ca ON ca.id = av.agreement_id WHERE ca.supplier_id = :sid AND av.estado = 'cerrado'"),
        {"sid": supplier_id},
    )
    crow = avg_compliance.fetchone()

    return {
        "acuerdos_activos": arow.total or 0,
        "monto_total_acordado": float(arow.monto_total or 0),
        "monto_ejecutado": float(arow.monto_ejecutado or 0),
        "porcentaje_ejecucion": float((arow.monto_total or 0) and (arow.monto_ejecutado or 0) / (arow.monto_total or 1) * 100),
        "rebates_pendientes": prow.total or 0,
        "monto_rebates_pendientes": float(prow.monto or 0),
        "cumplimiento_promedio": float(crow.avg or 0),
    }


async def get_supplier_price_competitiveness(db: AsyncSession, supplier_id: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT
                p.id as product_id, p.nombre, p.sku,
                COALESCE(SUM(CASE WHEN poi.precio_unitario > 0 THEN poi.precio_unitario ELSE NULL END), 0) as ult_precio,
                (SELECT COALESCE(AVG(poi2.precio_unitario), 0) FROM purchase_order_items poi2
                 JOIN purchase_orders po2 ON po2.id = poi2.purchase_order_id
                 WHERE poi2.product_id = p.id AND po2.supplier_id != :sid AND po2.estado NOT IN ('cancelado','borrador')
                 ORDER BY po2.fecha DESC LIMIT 5) as precio_competencia
            FROM purchase_order_items poi
            JOIN purchase_orders po ON po.id = poi.purchase_order_id
            JOIN products p ON p.id = poi.product_id
            WHERE po.supplier_id = :sid AND po.estado NOT IN ('cancelado','borrador')
            GROUP BY p.id, p.nombre, p.sku
            ORDER BY p.nombre
        """),
        {"sid": supplier_id},
    )
    return [
        {
            "producto": row.nombre, "sku": row.sku,
            "ultimo_precio": float(row.ult_precio or 0),
            "precio_competencia": float(row.precio_competencia or 0),
            "diferencia": float((row.ult_precio or 0) - (row.precio_competencia or 0)),
            "porcentaje_vs_competencia": float(
                (row.precio_competencia or 0) and (row.ult_precio or 0) / (row.precio_competencia or 1) * 100 - 100
            ),
        }
        for row in result.fetchall()
    ]


async def get_agreements_by_supplier(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT
                s.id as supplier_id, s.razon_social,
                COUNT(ca.id) as total_acuerdos,
                SUM(CASE WHEN ca.estado = 'activo' THEN 1 ELSE 0 END) as activos,
                SUM(CASE WHEN ca.estado = 'activo' THEN COALESCE(ca.monto_total_acordado, 0) ELSE 0 END) as monto_total,
                SUM(CASE WHEN ca.estado = 'activo' THEN COALESCE(ca.monto_ejecutado, 0) ELSE 0 END) as monto_ejecutado,
                SUM(CASE WHEN ca.estado = 'activo' AND ca.fecha_fin <= CURRENT_DATE + INTERVAL '30 days' THEN 1 ELSE 0 END) as proximo_vencer
            FROM suppliers s
            LEFT JOIN commercial_agreements ca ON ca.supplier_id = s.id AND ca.company_id = :company_id
            WHERE s.company_id = :company_id AND s.activo = true
            GROUP BY s.id, s.razon_social
            ORDER BY monto_total DESC
        """),
        {"company_id": company_id},
    )
    return [
        {
            "supplier_id": str(row.supplier_id),
            "razon_social": row.razon_social,
            "total_acuerdos": row.total_acuerdos or 0,
            "acuerdos_activos": row.activos or 0,
            "monto_total": float(row.monto_total or 0),
            "monto_ejecutado": float(row.monto_ejecutado or 0),
            "proximo_vencer": row.proximo_vencer or 0,
        }
        for row in result.fetchall()
    ]
