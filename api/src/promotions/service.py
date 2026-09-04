import io
import os
import uuid
from decimal import Decimal
from datetime import date, datetime, time, timezone
from typing import Optional, List, Dict, Any

from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.promotions.models import Promotion, PromotionUsage
from api.src.promotions.schemas import (
    PromotionCreate, PromotionUpdate,
    ValidateCartInput, ValidatedPromotion, CalculatePromoResponse,
    ProductDualPriceResponse, ReactivatePromoInput, RecordVendorCreditNoteInput,
    VendorClaimResponse, ApproveLossPromoInput
)
from api.src.products.models import Product
from api.src.purchases.models import Supplier, PurchaseOrder
from api.src.smart_pricing.models import TieredPrice


async def create_promotion(db: AsyncSession, company_id: str, data: PromotionCreate) -> Promotion:
    cid = uuid.UUID(company_id)
    
    # Evaluar si vende bajo costo
    costo_ref = data.costo_unitario_referencia or Decimal("0")
    precio_promo = data.precio_fijo_promocional or Decimal("0")
    es_bajo_costo = False
    if precio_promo > 0 and costo_ref > 0 and precio_promo < costo_ref:
        es_bajo_costo = True

    # Estado inicial: si vende bajo costo y es financiada por la tienda, pasa a aprobación
    estado_inicial = "pendiente_aprobacion_gerencia" if (es_bajo_costo and data.financiamiento == "propio_supermercado") else "activa"

    # Si es corto vencimiento con financiamiento de proveedor, calcular la obligación inicial en firme
    porcentaje_nc = data.porcentaje_nc_costo or Decimal("0")
    stock_lote = data.stock_limite_unidades or Decimal("0")
    monto_nc_comprometido = Decimal("0")
    nc_estado_inicial = "pendiente_liquidacion"

    if data.origen == "corto_vencimiento" and data.financiamiento == "proveedor_sell_out":
        if porcentaje_nc > 0 and stock_lote > 0 and costo_ref > 0:
            monto_nc_comprometido = stock_lote * (costo_ref * (porcentaje_nc / Decimal("100")))
            nc_estado_inicial = "obligacion_inicial_generada"
        elif data.monto_total_nc_comprometido and data.monto_total_nc_comprometido > 0:
            monto_nc_comprometido = data.monto_total_nc_comprometido
            nc_estado_inicial = "obligacion_inicial_generada"

    fecha_venc_lote = data.fecha_vencimiento_lote or data.valido_hasta

    promo = Promotion(
        company_id=cid,
        nombre=data.nombre,
        descripcion=data.descripcion,
        tipo=data.tipo,
        valor=data.valor,
        precio_fijo_promocional=data.precio_fijo_promocional,
        valor_maximo=data.valor_maximo,
        aplica_a=data.aplica_a,
        producto_ids=[uuid.UUID(p) for p in (data.producto_ids or [])] if data.producto_ids else None,
        categoria_ids=[uuid.UUID(c) for c in (data.categoria_ids or [])] if data.categoria_ids else None,
        
        origen=data.origen or "iniciativa_propia",
        financiamiento=data.financiamiento or "propio_supermercado",
        supplier_id=uuid.UUID(data.supplier_id) if data.supplier_id else None,
        purchases_invoices_ids=[uuid.UUID(p) for p in (data.purchases_invoices_ids or [])] if data.purchases_invoices_ids else None,
        porcentaje_aporte_proveedor=data.porcentaje_aporte_proveedor or Decimal("0"),
        porcentaje_aporte_tienda=data.porcentaje_aporte_tienda or Decimal("0"),
        monto_aporte_proveedor_pyg=data.monto_aporte_proveedor_pyg or Decimal("0"),
        monto_aporte_tienda_pyg=data.monto_aporte_tienda_pyg or Decimal("0"),
        
        costo_unitario_referencia=costo_ref,
        porcentaje_nc_costo=porcentaje_nc,
        monto_total_nc_comprometido=monto_nc_comprometido,
        fecha_vencimiento_lote=fecha_venc_lote,
        nc_estado=nc_estado_inicial,
        vende_bajo_costo=es_bajo_costo,
        estado=estado_inicial,
        
        limite_por_compra=data.limite_por_compra,
        limitar_unidades=data.limitar_unidades or (data.origen == "corto_vencimiento"),
        stock_limite_unidades=data.stock_limite_unidades,
        unidades_vendidas_promo=Decimal("0"),

        monto_minimo_compra=data.monto_minimo_compra,
        cantidad_minima=data.cantidad_minima,
        cantidad_maxima_items=data.cantidad_maxima_items,
        aplicaciones_por_cliente=data.aplicaciones_por_cliente,
        combinable=data.combinable,
        valido_desde=data.valido_desde,
        valido_hasta=data.valido_hasta,
        horario_desde=data.horario_desde,
        horario_hasta=data.horario_hasta,
        dias_semana=data.dias_semana,
        codigo_cupon=data.codigo_cupon,
        requiere_cupon=data.requiere_cupon,
        usos_maximos=data.usos_maximos,
        activo=data.activo if estado_inicial != "pendiente_aprobacion_gerencia" else False,
    )
    db.add(promo)
    await db.flush()
    await db.refresh(promo)
    return promo


async def get_promotion(db: AsyncSession, promo_id: str) -> Promotion | None:
    try:
        pid = uuid.UUID(promo_id)
    except ValueError:
        return None
    result = await db.execute(select(Promotion).where(Promotion.id == pid))
    return result.scalar_one_or_none()


async def list_promotions(
    db: AsyncSession,
    company_id: str,
    activo: bool | None = None,
    tipo: str | None = None,
    estado: str | None = None,
    origen_fuente: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Promotion]:
    try:
        cid = uuid.UUID(company_id)
    except ValueError:
        return []

    query = select(Promotion).where(Promotion.company_id == cid)
    if activo is not None:
        query = query.where(Promotion.activo == activo)
    if tipo:
        query = query.where(Promotion.tipo == tipo)
    if estado:
        query = query.where(Promotion.estado == estado)
    if origen_fuente:
        query = query.where(Promotion.origen_fuente == origen_fuente)

    query = query.order_by(Promotion.valido_desde.desc(), Promotion.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_promotion(db: AsyncSession, promo_id: str, data: PromotionUpdate) -> Promotion | None:
    promo = await get_promotion(db, promo_id)
    if not promo:
        return None
    update_data = data.model_dump(exclude_unset=True)
    if "producto_ids" in update_data and update_data["producto_ids"] is not None:
        update_data["producto_ids"] = [uuid.UUID(p) for p in update_data["producto_ids"]]
    if "categoria_ids" in update_data and update_data["categoria_ids"] is not None:
        update_data["categoria_ids"] = [uuid.UUID(c) for c in update_data["categoria_ids"]]
    if "supplier_id" in update_data and update_data["supplier_id"] is not None:
        update_data["supplier_id"] = uuid.UUID(update_data["supplier_id"])
    if "purchases_invoices_ids" in update_data and update_data["purchases_invoices_ids"] is not None:
        update_data["purchases_invoices_ids"] = [uuid.UUID(p) for p in update_data["purchases_invoices_ids"]]

    for field, value in update_data.items():
        setattr(promo, field, value)

    await db.flush()
    await db.refresh(promo)
    return promo


async def toggle_promotion_status(db: AsyncSession, company_id: str, promo_id: str) -> Promotion | None:
    promo = await get_promotion(db, promo_id)
    if not promo or str(promo.company_id) != company_id:
        return None
    
    if promo.activo:
        promo.activo = False
        promo.estado = "pausada"
    else:
        promo.activo = True
        promo.estado = "activa"
    
    await db.flush()
    await db.refresh(promo)
    return promo


async def reactivate_promotion(db: AsyncSession, company_id: str, promo_id: str, data: ReactivatePromoInput) -> Promotion | None:
    promo = await get_promotion(db, promo_id)
    if not promo or str(promo.company_id) != company_id:
        return None
    
    promo.valido_desde = data.valido_desde
    promo.valido_hasta = data.valido_hasta
    promo.activo = True
    promo.estado = "activa"
    promo.unidades_vendidas_promo = Decimal("0")
    if data.limite_por_compra is not None:
        promo.limite_por_compra = data.limite_por_compra
    if data.stock_limite_unidades is not None:
        promo.stock_limite_unidades = data.stock_limite_unidades
        promo.limitar_unidades = True

    await db.flush()
    await db.refresh(promo)
    return promo


async def approve_promotion_loss(db: AsyncSession, company_id: str, promo_id: str, user_id: str) -> Promotion | None:
    promo = await get_promotion(db, promo_id)
    if not promo or str(promo.company_id) != company_id:
        return None
    
    promo.estado = "activa"
    promo.activo = True
    promo.aprobado_por = uuid.UUID(user_id) if user_id else None
    promo.fecha_aprobacion = datetime.now(timezone.utc)
    
    await db.flush()
    await db.refresh(promo)
    return promo


async def resolve_product_promotions(
    db: AsyncSession,
    company_id: str,
    product_id: str,
    current_price: float,
    qty: float = 1.0,
    current_dt: Optional[datetime] = None,
) -> ProductDualPriceResponse:
    """Motor de Precio Dual: Resuelve en tiempo real si el producto tiene una promoción activa."""
    try:
        cid = uuid.UUID(company_id)
        pid = uuid.UUID(product_id)
    except ValueError:
        return ProductDualPriceResponse(
            en_promocion=False,
            precio_regular=current_price,
            precio_promocional=current_price,
        )

    now_dt = current_dt or datetime.now()
    today = now_dt.date()
    now_time = now_dt.time()
    sunday_dow = (today.weekday() + 1) % 7  # 0=Dom, 1=Lun ... 6=Sab

    # El motor de caja (calculate_applicable) ya reconocia promos por
    # categoria, pero este motor de precio dual (usado en catalogo/ficha de
    # producto) solo miraba producto_ids -- un producto que entraba a una
    # promo por categoria nunca mostraba el precio tachado aca, aunque en
    # caja si se descontaba. Se busca la categoria real del producto para
    # que ambos motores vean lo mismo.
    categoria_id_res = await db.execute(select(Product.categoria_id).where(Product.id == pid))
    categoria_id = categoria_id_res.scalar_one_or_none()

    condiciones_aplica = [
        Promotion.producto_ids.contains([pid]),
        Promotion.aplica_a == "carrito",
    ]
    if categoria_id:
        condiciones_aplica.append(
            and_(Promotion.aplica_a == "categoria", Promotion.categoria_ids.contains([categoria_id]))
        )

    result = await db.execute(
        select(Promotion).where(
            Promotion.company_id == cid,
            Promotion.activo == True,
            Promotion.estado == "activa",
            Promotion.valido_desde <= today,
            Promotion.valido_hasta >= today,
            or_(*condiciones_aplica)
        ).order_by(Promotion.created_at.desc())
    )
    promos = result.scalars().all()

    for p in promos:
        # Verificar cupo de stock limite
        if p.limitar_unidades and p.stock_limite_unidades:
            if (p.unidades_vendidas_promo or Decimal("0")) >= p.stock_limite_unidades:
                # Cupo agotado
                continue

        # Verificar horario y tolerancia de 60 min
        es_en_horario = True
        es_tolerancia_60min = False
        minutos_retraso = 0
        mensaje_tolerancia = None

        if p.horario_desde and p.horario_hasta:
            now_mins = now_time.hour * 60 + now_time.minute
            start_mins = p.horario_desde.hour * 60 + p.horario_desde.minute
            end_mins = p.horario_hasta.hour * 60 + p.horario_hasta.minute

            if start_mins <= now_mins <= end_mins:
                es_en_horario = True
            elif now_mins > end_mins and (now_mins - end_mins) <= 60:
                # Caso de Tolerancia por Cola en Caja (hasta 60 min post-cierre)
                es_en_horario = False
                es_tolerancia_60min = True
                minutos_retraso = now_mins - end_mins
                mensaje_tolerancia = f"⚡ Oferta relámpago finalizó hace {minutos_retraso} min (a las {p.horario_hasta.strftime('%H:%M')}). Requiere autorización de supervisor para aplicar precio oferta."
            else:
                es_en_horario = False

        # Verificar días de la semana
        es_activo_hoy = True
        mensaje_dias = None
        if p.dias_semana and len(p.dias_semana) > 0:
            if sunday_dow not in p.dias_semana:
                es_activo_hoy = False
                nombres_dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
                dias_txt = ", ".join([nombres_dias[d] for d in p.dias_semana if d < len(nombres_dias)])
                mensaje_dias = f"Válido: {dias_txt}"

        # Calcular precio promocional
        precio_regular = Decimal(str(current_price))
        precio_promo = precio_regular

        if p.tipo == "precio_fijo_oferta" and p.precio_fijo_promocional:
            precio_promo = round(p.precio_fijo_promocional)
        elif p.tipo == "porcentaje" and p.valor:
            descuento_pct = p.valor / Decimal("100")
            precio_promo = round(precio_regular * (Decimal("1") - descuento_pct))
        elif p.tipo == "monto_fijo" and p.valor:
            precio_promo = max(Decimal("0"), round(precio_regular - p.valor))

        if precio_promo < precio_regular and es_activo_hoy and es_en_horario:
            ahorro = precio_regular - precio_promo
            ahorro_pct = round((ahorro / precio_regular) * Decimal("100"), 1) if precio_regular > 0 else Decimal("0")
            
            badge = "🏷️ OFERTA EXTRA"
            if p.horario_desde and p.horario_hasta:
                badge = f"⚡ RELÁMPAGO ({p.horario_desde.strftime('%H:%M')}-{p.horario_hasta.strftime('%H:%M')})"
            elif p.origen == "corto_vencimiento":
                badge = "⚡ LIQUIDACIÓN"
            elif p.origen == "accion_proveedor":
                badge = "🌟 PROMO PROVEEDOR"

            return ProductDualPriceResponse(
                en_promocion=True,
                precio_regular=float(round(precio_regular)),
                precio_promocional=float(round(precio_promo)),
                ahorro_unitario=float(round(ahorro)),
                ahorro_porcentaje=float(ahorro_pct),
                promocion_id=str(p.id),
                promocion_nombre=p.nombre,
                badge=badge,
                limite_por_compra=p.limite_por_compra,
                valido_hasta=p.valido_hasta,
                dias_semana_activos=p.dias_semana,
                es_activo_hoy=True,
                mensaje_dias=mensaje_dias,
                es_relampago_expirada_en_tolerancia=False,
                minutos_retraso_relampago=0,
                requiere_autorizacion_supervisor=False,
                mensaje_tolerancia=None,
            )
        elif precio_promo < precio_regular and es_activo_hoy and es_tolerancia_60min:
            # En ventana de tolerancia (0 a 60 min post-cierre) -> Requiere Supervisor
            ahorro = precio_regular - precio_promo
            ahorro_pct = round((ahorro / precio_regular) * Decimal("100"), 1)
            return ProductDualPriceResponse(
                en_promocion=False,
                precio_regular=float(precio_regular),
                precio_promocional=float(precio_promo),
                ahorro_unitario=float(ahorro),
                ahorro_porcentaje=float(ahorro_pct),
                promocion_id=str(p.id),
                promocion_nombre=p.nombre,
                badge=f"⚡ TOLERANCIA ({minutos_retraso} min)",
                limite_por_compra=p.limite_por_compra,
                valido_hasta=p.valido_hasta,
                dias_semana_activos=p.dias_semana,
                es_activo_hoy=True,
                mensaje_dias=f"Expiró a las {p.horario_hasta.strftime('%H:%M')}",
                es_relampago_expirada_en_tolerancia=True,
                minutos_retraso_relampago=minutos_retraso,
                requiere_autorizacion_supervisor=True,
                mensaje_tolerancia=mensaje_tolerancia,
            )
        elif precio_promo < precio_regular and (not es_activo_hoy or not es_en_horario):
            # Promo configurada pero inactiva hoy o fuera de horario
            ahorro = precio_regular - precio_promo
            ahorro_pct = round((ahorro / precio_regular) * Decimal("100"), 1)
            msg = mensaje_dias
            if p.horario_desde and p.horario_hasta and not es_en_horario:
                msg = f"⚡ Válido de {p.horario_desde.strftime('%H:%M')} a {p.horario_hasta.strftime('%H:%M')}"

            return ProductDualPriceResponse(
                en_promocion=False,
                precio_regular=float(precio_regular),
                precio_promocional=float(precio_promo),
                ahorro_unitario=float(ahorro),
                ahorro_porcentaje=float(ahorro_pct),
                promocion_id=str(p.id),
                promocion_nombre=p.nombre,
                badge=None,
                limite_por_compra=p.limite_por_compra,
                valido_hasta=p.valido_hasta,
                dias_semana_activos=p.dias_semana,
                es_activo_hoy=False,
                mensaje_dias=msg,
                es_relampago_expirada_en_tolerancia=False,
                minutos_retraso_relampago=0,
                requiere_autorizacion_supervisor=False,
                mensaje_tolerancia=None,
            )

    return ProductDualPriceResponse(
        en_promocion=False,
        precio_regular=current_price,
        precio_promocional=current_price,
    )


async def generate_sell_out_claim(db: AsyncSession, company_id: str, promo_id: str) -> VendorClaimResponse:
    """Consolida el reporte de ventas sell-out para reclamar la Nota de Crédito al proveedor,
    identificando al proveedor comercial titular y las facturas de compra/órdenes afectadas."""
    promo = await get_promotion(db, promo_id)
    if not promo:
        raise ValueError("Promoción no encontrada")

    usages_res = await db.execute(
        select(PromotionUsage).where(PromotionUsage.promotion_id == promo.id)
    )
    usages = usages_res.scalars().all()

    total_unidades = sum(u.cantidad_items or Decimal("1") for u in usages)
    total_descuento_general = sum(u.descuento_aplicado or Decimal("0") for u in usages)

    prov_pct = promo.porcentaje_aporte_proveedor or (Decimal("100") if promo.financiamiento == "proveedor_sell_out" else Decimal("0"))
    tienda_pct = promo.porcentaje_aporte_tienda or (Decimal("100") if promo.financiamiento == "propio_supermercado" else Decimal("0"))

    total_rebate = total_descuento_general
    total_aporte_tienda = Decimal("0")
    if promo.financiamiento == "co_financiado":
        total_pct = prov_pct + tienda_pct
        if total_pct > 0:
            total_rebate = total_descuento_general * (prov_pct / total_pct)
            total_aporte_tienda = total_descuento_general * (tienda_pct / total_pct)
        elif prov_pct > 0:
            total_rebate = total_descuento_general * (prov_pct / Decimal("100"))
            total_aporte_tienda = total_descuento_general - total_rebate
    elif promo.financiamiento == "propio_supermercado":
        total_rebate = Decimal("0")
        total_aporte_tienda = total_descuento_general
    else:
        total_aporte_tienda = Decimal("0")

    supplier_id = promo.supplier_id
    supplier_nombre = "Proveedor General"
    supplier_ruc = None
    supplier_email = None
    supplier_telefono = None

    # Si no tiene supplier_id directo, buscar el proveedor de los productos incluidos
    if not supplier_id and promo.producto_ids:
        supp_find = await db.execute(
            text("""
                SELECT po.supplier_id, s.razon_social, s.ruc, s.email, s.telefono
                FROM purchase_order_items poi
                JOIN purchase_orders po ON po.id = poi.purchase_order_id
                JOIN suppliers s ON s.id = po.supplier_id
                WHERE poi.product_id = ANY(:p_ids)
                ORDER BY poi.created_at DESC
                LIMIT 1
            """),
            {"p_ids": [uuid.UUID(str(p)) for p in promo.producto_ids if p]}
        )
        s_row = supp_find.first()
        if s_row:
            supplier_id = s_row[0]
            supplier_nombre = s_row[1]
            supplier_ruc = s_row[2]
            supplier_email = s_row[3]
            supplier_telefono = s_row[4]

    if supplier_id and not supplier_ruc:
        supp_res = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
        supp = supp_res.scalar_one_or_none()
        if supp:
            supplier_nombre = supp.razon_social or supp.nombre
            supplier_ruc = supp.ruc
            supplier_email = supp.email
            supplier_telefono = supp.telefono

    # Facturas / Órdenes de compra afectadas
    facturas_ref = []
    if promo.purchases_invoices_ids:
        po_res = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id.in_(promo.purchases_invoices_ids)))
        for po in po_res.scalars().all():
            facturas_ref.append({
                "id": str(po.id),
                "numero": po.numero or f"FAC-{str(po.id)[:8]}",
                "timbrado": getattr(po, "timbrado", None) or "18545636",
                "fecha": po.created_at.strftime("%d/%m/%Y") if po.created_at else "S/F",
                "total": float(po.total or 0)
            })
    elif promo.producto_ids:
        po_res = await db.execute(
            select(PurchaseOrder)
            .join(PurchaseOrderItem, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
            .where(PurchaseOrderItem.product_id.in_([uuid.UUID(str(p)) for p in promo.producto_ids if p]))
            .order_by(PurchaseOrder.created_at.desc())
            .limit(6)
        )
        for po in po_res.scalars().all():
            facturas_ref.append({
                "id": str(po.id),
                "numero": po.numero or f"FAC-{str(po.id)[:8]}",
                "timbrado": getattr(po, "timbrado", None) or "18545636",
                "fecha": po.created_at.strftime("%d/%m/%Y") if po.created_at else "S/F",
                "total": float(po.total or 0)
            })
    elif supplier_id:
        po_res = await db.execute(
            select(PurchaseOrder)
            .where(PurchaseOrder.supplier_id == supplier_id)
            .order_by(PurchaseOrder.created_at.desc())
            .limit(6)
        )
        for po in po_res.scalars().all():
            facturas_ref.append({
                "id": str(po.id),
                "numero": po.numero or f"FAC-{str(po.id)[:8]}",
                "timbrado": getattr(po, "timbrado", None) or "18545636",
                "fecha": po.created_at.strftime("%d/%m/%Y") if po.created_at else "S/F",
                "total": float(po.total or 0)
            })

    return VendorClaimResponse(
        promotion_id=str(promo.id),
        promotion_nombre=promo.nombre,
        financiamiento=promo.financiamiento or "proveedor_sell_out",
        porcentaje_aporte_proveedor=float(prov_pct),
        porcentaje_aporte_tienda=float(tienda_pct),
        supplier_id=str(supplier_id) if supplier_id else None,
        supplier_nombre=supplier_nombre,
        supplier_ruc=supplier_ruc,
        supplier_email=supplier_email,
        supplier_telefono=supplier_telefono,
        unidades_vendidas=float(total_unidades),
        total_descuento_general=float(total_descuento_general),
        total_rebate_reclamar=float(total_rebate),
        total_aporte_tienda=float(total_aporte_tienda),
        facturas_compra_referencia=facturas_ref,
        fecha_corte=datetime.utcnow()
    )


async def record_vendor_credit_note(
    db: AsyncSession, company_id: str, promo_id: str, data: RecordVendorCreditNoteInput
) -> Promotion | None:
    promo = await get_promotion(db, promo_id)
    if not promo:
        return None
    
    promo.nc_numero_proveedor = data.nc_numero_proveedor
    promo.nc_timbrado_proveedor = data.nc_timbrado_proveedor
    promo.nc_monto_total = data.nc_monto_total
    promo.nc_estado = "nc_recibida_conciliada"

    await db.flush()
    await db.refresh(promo)
    return promo


async def sync_nemuha_promotions(db: AsyncSession, company_id: str) -> dict:
    """Sincroniza en lote todas las promociones activas e históricas de ven_promocao de MySQL Nemuha."""
    try:
        import pymysql
    except ImportError:
        return {"error": "pymysql no instalado"}

    cid = uuid.UUID(company_id)
    host = os.getenv("NEMUHA_MYSQL_HOST", "100.76.95.42")
    port = int(os.getenv("NEMUHA_MYSQL_PORT", "3306"))
    user = os.getenv("NEMUHA_MYSQL_USER", "intelimarket_ro")
    password = os.getenv("NEMUHA_MYSQL_PASSWORD", "Luzma7834")
    database = os.getenv("NEMUHA_MYSQL_DATABASE", "comercial_extra_py")

    conn = pymysql.connect(
        host=host, port=port, user=user, password=password, database=database,
        cursorclass=pymysql.cursors.DictCursor
    )

    imported_count = 0
    updated_count = 0

    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM ven_promocao ORDER BY ID_PROMOCAO DESC LIMIT 1000")
        rows = cursor.fetchall()

    for r in rows:
        legacy_id = r["ID_PROMOCAO"]
        # Buscar si ya existe por legacy_id
        exist_res = await db.execute(
            select(Promotion).where(Promotion.company_id == cid, Promotion.legacy_id == legacy_id)
        )
        existing = exist_res.scalar_one_or_none()

        dias_semana = []
        if r.get("BO_DOMINGO"): dias_semana.append(0)
        if r.get("BO_SEGUNDA"): dias_semana.append(1)
        if r.get("BO_TERCA"): dias_semana.append(2)
        if r.get("BO_QUARTA"): dias_semana.append(3)
        if r.get("BO_QUINTA"): dias_semana.append(4)
        if r.get("BO_SEXTA"): dias_semana.append(5)
        if r.get("BO_SABADO"): dias_semana.append(6)

        dt_inicio = r.get("DT_INICIO_PROMOCAO") or date.today()
        dt_fim = r.get("DT_FIM_PROMOCAO")
        if isinstance(dt_fim, datetime):
            valido_hasta = dt_fim.date()
        elif isinstance(dt_fim, date):
            valido_hasta = dt_fim
        else:
            valido_hasta = date(2026, 12, 31)

        precio_promo = r.get("VL_PRECO_VAREJO") or Decimal("0")
        precio_orig = r.get("VL_PRECO_VAREJO_PRODUTO") or Decimal("0")
        
        # Buscar producto local por SKU / código Nemuha
        prod_sku = str(r["ID_PRODUTO"])
        p_res = await db.execute(
            select(Product).where(Product.company_id == cid, or_(Product.sku == prod_sku, Product.codigo_barra == prod_sku))
        )
        matched_prod = p_res.scalar_one_or_none()
        prod_ids = [matched_prod.id] if matched_prod else None

        is_active = valido_hasta >= date.today()

        if not existing:
            promo = Promotion(
                company_id=cid,
                nombre=f"Promo Nemuha #{legacy_id} ({matched_prod.nombre if matched_prod else 'Ítem ' + prod_sku})",
                descripcion=r.get("OBSERVACAO") or f"Sincronizado de Nemuha legacy ID {legacy_id}",
                tipo="precio_fijo_oferta",
                precio_fijo_promocional=precio_promo,
                aplica_a="producto" if prod_ids else "carrito",
                producto_ids=prod_ids,
                origen="accion_proveedor" if r.get("TIPO_PROMOCAO") == "ESTOQUE_LIMITADO" else "iniciativa_propia",
                financiamiento="propio_supermercado",
                valido_desde=dt_inicio,
                valido_hasta=valido_hasta,
                dias_semana=dias_semana if len(dias_semana) > 0 else None,
                activo=is_active,
                estado="activa" if is_active else "finalizada_por_fecha",
                origen_fuente="nemuha",
                legacy_id=legacy_id,
            )
            db.add(promo)
            imported_count += 1
        else:
            existing.precio_fijo_promocional = precio_promo
            existing.valido_desde = dt_inicio
            existing.valido_hasta = valido_hasta
            existing.dias_semana = dias_semana if len(dias_semana) > 0 else None
            existing.activo = is_active
            existing.estado = "activa" if is_active else "finalizada_por_fecha"
            if prod_ids:
                existing.producto_ids = prod_ids
            updated_count += 1

    await db.flush()
    return {"importados": imported_count, "actualizados": updated_count, "total_evaluados": len(rows)}


async def calculate_applicable(
    db: AsyncSession, company_id: str, input: ValidateCartInput,
) -> CalculatePromoResponse:
    """Motor de cálculo en caja: Valida promociones y escalas mayoristas."""
    cid = uuid.UUID(company_id)
    today = date.today()
    now_time = datetime.now().time()
    sunday_dow = (today.weekday() + 1) % 7

    promos_res = await db.execute(
        select(Promotion).where(
            Promotion.company_id == cid,
            Promotion.activo == True,
            Promotion.estado == "activa",
            Promotion.valido_desde <= today,
            Promotion.valido_hasta >= today,
        )
    )
    promos = list(promos_res.scalars().all())

    applicable: list[ValidatedPromotion] = []
    total_descuento_promo = Decimal("0")
    total_descuento_mayorista = Decimal("0")

    # 1. Evaluar Escalas Mayoristas (TieredPrice)
    for item in input.items:
        try:
            pid = uuid.UUID(item.producto_id)
            tiers_res = await db.execute(
                select(TieredPrice).where(
                    TieredPrice.company_id == cid,
                    TieredPrice.product_id == pid,
                    TieredPrice.activo == True,
                    TieredPrice.min_qty <= item.cantidad,
                ).order_by(TieredPrice.min_qty.desc())
            )
            best_tier = tiers_res.scalar_one_or_none()
            if best_tier and best_tier.precio_unitario < item.precio_unitario:
                dif = (item.precio_unitario - best_tier.precio_unitario) * Decimal(str(item.cantidad))
                total_descuento_mayorista += dif
        except Exception:
            pass

    total_cart = sum(Decimal(str(it.cantidad)) * it.precio_unitario for it in input.items)
    total_qty_cart = sum(Decimal(str(it.cantidad)) for it in input.items)

    # 2. Evaluar Promociones Vigentes con límite por compra y stock
    # Las no-combinables se evalúan primero para que se queden con exclusividad
    # sobre los items que tocan -- antes "combinable" se guardaba pero nunca se
    # respetaba, el motor sumaba el descuento de TODAS las promos aplicables.
    claimed_items: set[str] = set()
    for p in sorted(promos, key=lambda pr: pr.combinable):
        # Verificar límite de stock
        if p.limitar_unidades and p.stock_limite_unidades:
            if (p.unidades_vendidas_promo or Decimal("0")) >= p.stock_limite_unidades:
                continue

        # Tope de usos totales de la promoción (se guardaba pero nunca se
        # comparaba contra usos_actuales, la promo seguia aplicando sin fin)
        if p.usos_maximos and (p.usos_actuales or 0) >= p.usos_maximos:
            continue

        # Verificar días de semana
        if p.dias_semana and len(p.dias_semana) > 0:
            if sunday_dow not in p.dias_semana:
                continue

        # Verificar horario
        if p.horario_desde and p.horario_hasta:
            if not (p.horario_desde <= now_time <= p.horario_hasta):
                continue

        # Cupones
        if p.requiere_cupon:
            if not input.codigo_cupon or input.codigo_cupon.lower() != (p.codigo_cupon or "").lower():
                continue

        # Monto minimo de compra (sobre el total del carrito completo)
        if p.monto_minimo_compra and total_cart < p.monto_minimo_compra:
            continue

        # Cantidad minima de items en el carrito para desbloquear la promo
        if p.cantidad_minima and total_qty_cart < p.cantidad_minima:
            continue

        # Tope de aplicaciones por cliente (necesita customer_id en el input;
        # sin cliente identificado no se puede acotar, se deja pasar)
        if p.aplicaciones_por_cliente and input.customer_id:
            try:
                usos_cliente_res = await db.execute(
                    select(func.count(PromotionUsage.id)).where(
                        PromotionUsage.promotion_id == p.id,
                        PromotionUsage.customer_id == uuid.UUID(input.customer_id),
                    )
                )
                usos_cliente = usos_cliente_res.scalar() or 0
                if usos_cliente >= p.aplicaciones_por_cliente:
                    continue
            except Exception:
                pass

        # Aplicación por producto / categoría / carrito -- se excluyen los
        # items ya reclamados en exclusividad por una promo no-combinable
        # evaluada antes (ver sorted() arriba).
        aplica_items = []
        for item in input.items:
            if item.producto_id in claimed_items:
                continue
            try:
                pid = uuid.UUID(item.producto_id)
                if p.aplica_a == "carrito":
                    aplica_items.append(item)
                elif p.aplica_a == "producto" and p.producto_ids and pid in p.producto_ids:
                    aplica_items.append(item)
                elif p.aplica_a == "categoria" and p.categoria_ids and item.categoria_id and uuid.UUID(item.categoria_id) in p.categoria_ids:
                    aplica_items.append(item)
            except Exception:
                pass

        if not aplica_items:
            continue

        descuento_p = Decimal("0")
        qty_acumulada = Decimal("0")
        items_con_descuento = []
        for it in aplica_items:
            # Control de limite_por_compra (tope por linea de producto)
            qty_promo = Decimal(str(it.cantidad))
            if p.limite_por_compra and qty_promo > Decimal(str(p.limite_por_compra)):
                qty_promo = Decimal(str(p.limite_por_compra))

            # Tope de cantidad total de items que la promo cubre en todo el
            # carrito (se guardaba pero nunca se acotaba la suma real)
            if p.cantidad_maxima_items:
                restante = Decimal(str(p.cantidad_maxima_items)) - qty_acumulada
                if restante <= 0:
                    break
                if qty_promo > restante:
                    qty_promo = restante
            qty_acumulada += qty_promo

            if p.tipo == "precio_fijo_oferta" and p.precio_fijo_promocional:
                if p.precio_fijo_promocional < it.precio_unitario:
                    descuento_p += (it.precio_unitario - p.precio_fijo_promocional) * qty_promo
                    items_con_descuento.append(it)
            elif p.tipo == "porcentaje" and p.valor:
                pct = max(Decimal("0"), min(p.valor, Decimal("100"))) / Decimal("100")
                descuento_p += (it.precio_unitario * qty_promo) * pct
                items_con_descuento.append(it)
            elif p.tipo == "monto_fijo" and p.valor:
                descuento_p += min(p.valor, it.precio_unitario * qty_promo)
                items_con_descuento.append(it)

        if p.valor_maximo and descuento_p > p.valor_maximo:
            descuento_p = p.valor_maximo

        if descuento_p > 0:
            applicable.append(ValidatedPromotion(
                promotion_id=str(p.id),
                nombre=p.nombre,
                tipo=p.tipo,
                descuento=float(descuento_p),
                descuento_maximo=float(p.valor_maximo) if p.valor_maximo else None,
                items_aplicados=[it.producto_id for it in items_con_descuento],
                descripcion=p.descripcion,
            ))
            total_descuento_promo += descuento_p
            if not p.combinable:
                claimed_items.update(it.producto_id for it in items_con_descuento)
    ahorro_total = total_descuento_promo + total_descuento_mayorista
    total_final = max(Decimal("0"), total_cart - ahorro_total)

    # Formatear el recuadro térmico ESC/POS
    if ahorro_total > 0:
        recuadro = (
            "  ┌─────────────────────────────────────────┐\n"
            "  │   ¡FELICIDADES! TU EXTRA AHORRO HOY:    │\n"
            f"  │               ₲ {int(ahorro_total):,d}".replace(",", ".") + "                  │\n"
        )
        if total_descuento_promo > 0:
            recuadro += f"  │   • En Promociones:       ₲ {int(total_descuento_promo):,d}".replace(",", ".") + "      │\n"
        if total_descuento_mayorista > 0:
            recuadro += f"  │   • En Precios Mayoristas: ₲ {int(total_descuento_mayorista):,d} [M]".replace(",", ".") + " │\n"
        recuadro += "  └─────────────────────────────────────────┘"
    else:
        recuadro = (
            "  ┌─────────────────────────────────────────┐\n"
            "  │     ¡SUMATE AL EXTRA AHORRO DIARIO!     │\n"
            "  │  • Comprá por fardo/caja a precio [M]   │\n"
            "  │  • Aprovechá las Ofertas de la Semana   │\n"
            "  │   ¡Los mejores precios de la región!    │\n"
            "  └─────────────────────────────────────────┘"
        )

    return CalculatePromoResponse(
        applicable_promotions=applicable,
        total_descuento_promociones=float(total_descuento_promo),
        total_descuento_mayorista=float(total_descuento_mayorista),
        total_descuento_general=float(ahorro_total),
        total_final=float(total_final),
        ahorro_total_compra=float(ahorro_total),
        recuadro_ticket_texto=recuadro
    )


async def authorize_flash_grace_override(
    db: AsyncSession,
    company_id: str,
    data: AuthorizeFlashGraceInput,
    user_id: Optional[str] = None,
) -> AuthorizeFlashGraceResponse:
    """Autorización supervisada de excepción por tolerancia de 60 min en promo relámpago con auditoría."""
    from api.src.inteliaudit.service import record_audit_event
    
    cid = uuid.UUID(company_id)
    promo = await get_promotion(db, data.promotion_id)
    if not promo:
        raise ValueError("Promoción no encontrada")

    descuento_unitario = max(Decimal("0"), data.precio_regular - data.precio_autorizado)

    # Registrar Evento de Auditoría y Control de Riesgos
    audit_data = {
        "company_id": str(cid),
        "user_id": str(data.supervisor_id) if data.supervisor_id else user_id,
        "accion": "autorizacion_tolerancia_promo_relampago",
        "entidad": "promotions",
        "entidad_id": data.promotion_id,
        "datos_anteriores": {
            "precio_regular": float(data.precio_regular),
            "estado_promo": "expirada_en_tolerancia",
            "horario_limite": promo.horario_hasta.strftime("%H:%M") if promo.horario_hasta else None,
        },
        "datos_nuevos": {
            "precio_autorizado": float(data.precio_autorizado),
            "descuento_otorgado": float(descuento_unitario),
            "minutos_retraso": data.minutos_retraso,
            "cajero_id": str(data.cajero_id) if data.cajero_id else None,
            "caja_numero": data.caja_numero,
            "supervisor_id": str(data.supervisor_id) if data.supervisor_id else user_id,
            "motivo": data.motivo,
            "riesgo_score": 45,
            "tipo_control": "grace_period_supervision",
        },
        "ip_address": "pos-caja-" + str(data.caja_numero or "012"),
        "user_agent": "InteliMarket-POS-Retail/1.0",
    }

    audit_res = await record_audit_event(db, audit_data)
    audit_id = audit_res.get("id") or str(uuid.uuid4())

    # Registrar uso de promoción autorizada
    if data.sale_id:
        await log_promotion_usage(
            db=db,
            promotion_id=data.promotion_id,
            company_id=company_id,
            sale_id=data.sale_id,
            descuento=descuento_unitario,
            customer_id=None,
            branch_id=None,
            items_aplicados=[data.product_id],
            cantidad_items=Decimal("1"),
            precio_regular=data.precio_regular,
            precio_promo=data.precio_autorizado,
            es_mayorista=False,
        )

    return AuthorizeFlashGraceResponse(
        autorizado=True,
        audit_event_id=audit_id,
        descuento_aplicado=float(descuento_unitario),
        precio_final_unitario=float(data.precio_autorizado),
        mensaje=f"Autorización registrada exitosamente por supervisor (Retraso: {data.minutos_retraso} min). Evento de auditoría: {audit_id[:8]}",
    )



async def log_promotion_usage(
    db: AsyncSession,
    promotion_id: str,
    company_id: str,
    sale_id: str,
    descuento: Decimal,
    customer_id: str | None = None,
    branch_id: str | None = None,
    codigo_cupon: str | None = None,
    items_aplicados: list[str] | None = None,
    cantidad_items: Decimal = Decimal("1"),
    precio_regular: Decimal = Decimal("0"),
    precio_promo: Decimal = Decimal("0"),
    es_mayorista: bool = False,
) -> None:
    try:
        pid = uuid.UUID(promotion_id)
        cid = uuid.UUID(company_id)
        sid = uuid.UUID(sale_id)
    except ValueError:
        return

    usage = PromotionUsage(
        promotion_id=pid,
        company_id=cid,
        sale_id=sid,
        customer_id=uuid.UUID(customer_id) if customer_id else None,
        branch_id=uuid.UUID(branch_id) if branch_id else None,
        codigo_cupon=codigo_cupon,
        descuento_aplicado=descuento,
        cantidad_items=cantidad_items,
        precio_regular_unitario=precio_regular,
        precio_promo_unitario=precio_promo,
        es_venta_mayorista=es_mayorista,
        items_aplicados=[uuid.UUID(i) for i in (items_aplicados or [])] if items_aplicados else None,
    )
    db.add(usage)

    # Actualizar contador y cupo de unidades
    promo = await get_promotion(db, promotion_id)
    if promo:
        promo.usos_actuales = (promo.usos_actuales or 0) + 1
        promo.unidades_vendidas_promo = (promo.unidades_vendidas_promo or Decimal("0")) + cantidad_items
        
        # Auto-cierre si agotó cupo
        if promo.limitar_unidades and promo.stock_limite_unidades:
            if promo.unidades_vendidas_promo >= promo.stock_limite_unidades:
                promo.estado = "finalizada_por_stock"
                promo.activo = False

        # Auto-cierre si agotó el tope de usos (se guardaba pero nunca se
        # comparaba contra usos_actuales -- la promo seguia activa sin fin)
        if promo.usos_maximos and promo.usos_actuales >= promo.usos_maximos:
            promo.estado = "finalizada_por_usos"
            promo.activo = False

    await db.flush()


async def get_expiring_promotions_alerts(db: AsyncSession, company_id: str) -> list[Dict[str, Any]]:
    """Genera alertas preventivas escalonadas de vencimiento (15 días, 10 días, 5 días y vencidos)
    para que gerencia y salón retiren productos o aceleren la rotación comercial."""
    cid = uuid.UUID(company_id)
    today = date.today()

    query = (
        select(Promotion)
        .where(
            Promotion.company_id == cid,
            Promotion.activo == True,
            or_(
                Promotion.origen == "corto_vencimiento",
                Promotion.fecha_vencimiento_lote != None,
                Promotion.valido_hasta != None
            )
        )
    )
    result = await db.execute(query)
    promos = result.scalars().all()

    alerts = []
    for p in promos:
        fecha_venc = p.fecha_vencimiento_lote or p.valido_hasta
        if not fecha_venc:
            continue

        dias_restantes = (fecha_venc - today).days

        # Solo alertar si faltan 15 días o menos, o si ya venció (dias_restantes <= 0)
        if dias_restantes > 15:
            continue

        stock_ini = float(p.stock_limite_unidades or 0)
        vendidas = float(p.unidades_vendidas_promo or 0)
        restantes = max(0.0, stock_ini - vendidas) if stock_ini > 0 else 0.0

        if dias_restantes <= 0:
            nivel = "vencido"
            mensaje = f"🚨 LOTE VENCIDO: Retirar {int(restantes)} unidades restantes de salón para devolución/ajuste con proveedor."
        elif dias_restantes <= 5:
            nivel = "urgente_5_dias"
            mensaje = f"🔴 URGENTE (5 Días): Quedan {dias_restantes} días para vencimiento. Acelerar exhibición en cabecera de góndola."
        elif dias_restantes <= 10:
            nivel = "alerta_10_dias"
            mensaje = f"🟠 ALERTA (10 Días): Quedan {dias_restantes} días de vigencia antes del vencimiento del lote."
        else:
            nivel = "aviso_15_dias"
            mensaje = f"🟡 AVISO TEMPRANO (15 Días): Lote en liquidación a 15 días del vencimiento."

        # Obtener nombre del producto
        prod_nombre = p.nombre
        prod_id_str = None
        if p.producto_ids and len(p.producto_ids) > 0:
            prod_id_str = str(p.producto_ids[0])
            prod_res = await db.execute(select(Product.nombre).where(Product.id == p.producto_ids[0]))
            pn = prod_res.scalar()
            if pn:
                prod_nombre = pn

        # Obtener nombre del proveedor
        sup_nombre = None
        if p.supplier_id:
            sup_res = await db.execute(select(Supplier.razon_social).where(Supplier.id == p.supplier_id))
            sup_nombre = sup_res.scalar()

        alerts.append({
            "promotion_id": str(p.id),
            "promotion_nombre": p.nombre,
            "product_id": prod_id_str,
            "product_nombre": prod_nombre,
            "fecha_vencimiento": fecha_venc,
            "dias_restantes": dias_restantes,
            "nivel_alerta": nivel,
            "stock_limite_inicial": stock_ini,
            "unidades_vendidas": vendidas,
            "unidades_restantes": restantes,
            "monto_nc_comprometido": float(p.monto_total_nc_comprometido or 0),
            "supplier_nombre": sup_nombre,
            "mensaje_accion": mensaje,
        })

    alerts.sort(key=lambda x: x["dias_restantes"])
    return alerts
