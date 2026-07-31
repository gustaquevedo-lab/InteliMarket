"""Retail service — KPIs, coupons, events, POS, online storefront."""
import secrets
import string
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc, text
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from api.src.retail import models, schemas


def _utcnow():
    return datetime.now(timezone.utc)


# ════════════════════════════════════════════════════════════
#  PARAGUAY CALENDAR EVENTS (seed data)
# ════════════════════════════════════════════════════════════

PY_CALENDAR_2026 = [
    {"codigo": "dia_madre", "nombre": "Día de la Madre", "fecha_evento": "2026-05-15", "icono": "💐", "categoria": "festividad", "descripcion": "Regalos, cenas, desayunos. Categorías top: belleza, joyería, gastronomía, ropa."},
    {"codigo": "dia_padre", "nombre": "Día del Padre", "fecha_evento": "2026-03-19", "icono": "👔", "categoria": "festividad", "descripcion": "Herramientas, ropa, electrónica, experiencias."},
    {"codigo": "dia_nino", "nombre": "Día del Niño", "fecha_evento": "2026-08-16", "icono": "🧸", "categoria": "festividad", "descripcion": "Juguetes, ropa infantil, libros, golosinas."},
    {"codigo": "san_juan", "nombre": "San Juan", "fecha_evento": "2026-06-24", "icono": "🔥", "categoria": "festividad", "descripcion": "Chipa, mbeyú, dulces tradicionales. Pico histórico 18-24 jun."},
    {"codigo": "vuelta_clases", "nombre": "Vuelta a Clases", "fecha_evento": "2026-02-15", "fecha_fin": "2026-03-05", "icono": "📚", "categoria": "escolar", "descripcion": "Útiles, mochilas, uniformes, tecnología."},
    {"codigo": "black_friday", "nombre": "Black Friday Paraguay", "fecha_evento": "2026-11-27", "icono": "🛍️", "categoria": "comercial", "descripcion": "Saldos masivos, descuentos agresivos, alto tráfico."},
    {"codigo": "cyber_monday", "nombre": "Cyber Monday", "fecha_evento": "2026-11-30", "icono": "💻", "categoria": "comercial", "descripcion": "Online, electrónica, moda."},
    {"codigo": "navidad", "nombre": "Navidad", "fecha_evento": "2026-12-25", "fecha_fin": "2026-12-24", "icono": "🎄", "categoria": "festividad", "descripcion": "Regalos, cena, pan dulce. Pico 20-24 dic."},
    {"codigo": "ano_nuevo", "nombre": "Año Nuevo", "fecha_evento": "2026-12-31", "icono": "🎆", "categoria": "festividad", "descripcion": "Brindis, decoración, ropa blanca."},
    {"codigo": "amor_amistad", "nombre": "Día del Amor y la Amistad", "fecha_evento": "2026-09-14", "icono": "❤️", "categoria": "festividad", "descripcion": "Flores, chocolates, cenas, joyería."},
    {"codigo": "halloween", "nombre": "Halloween", "fecha_evento": "2026-10-31", "icono": "🎃", "categoria": "comercial", "descripcion": "Disfraces, decoración, dulces."},
    {"codigo": "pascua", "nombre": "Pascua", "fecha_evento": "2026-04-05", "icono": "🐰", "categoria": "festividad", "descripcion": "Chocolate, huevos de pascua, gastronomía."},
    {"codigo": "independencia_py", "nombre": "Independencia Paraguay", "fecha_evento": "2026-05-14", "icono": "🇵🇾", "categoria": "festividad", "descripcion": "Patrio, gastronomía típica."},
    {"codigo": "verano", "nombre": "Temporada de Verano", "fecha_evento": "2026-12-21", "fecha_fin": "2027-03-20", "icono": "🏖️", "categoria": "estacional", "descripcion": "Ropa de baño, protector solar, bebidas,出去玩."},
    {"codigo": "san_valentin", "nombre": "San Valentín", "fecha_evento": "2026-02-14", "icono": "💝", "categoria": "festividad", "descripcion": "Detalle romántico, cena, flores, joyería."},
]

PRODUCTOS_POR_EVENTO = {
    "dia_madre": {"categorias": ["belleza", "joyeria", "perfumeria", "ropa_dama"], "lift_pct": 35, "margen_sugerido": 40},
    "dia_padre": {"categorias": ["herramientas", "electronica", "ropa_caballero", "experiencias"], "lift_pct": 25, "margen_sugerido": 35},
    "dia_nino": {"categorias": ["juguetes", "ropa_ninos", "libros_infantil", "golosinas"], "lift_pct": 45, "margen_sugerido": 30},
    "san_juan": {"categorias": ["panaderia", "almidon", "queso", "dulces_tradicionales"], "lift_pct": 80, "margen_sugerido": 25},
    "vuelta_clases": {"categorias": ["utiles_escolares", "mochilas", "uniformes", "tecnologia"], "lift_pct": 50, "margen_sugerido": 20},
    "black_friday": {"categorias": ["todos"], "lift_pct": 200, "margen_sugerido": 15},
    "navidad": {"categorias": ["juguetes", "electronica", "pan_duce", "bebidas", "regalos"], "lift_pct": 60, "margen_sugerido": 30},
}


# ════════════════════════════════════════════════════════════
#  STORE CONFIG
# ════════════════════════════════════════════════════════════

async def get_store_config(db: AsyncSession, company_id: UUID, branch_id: UUID) -> Optional[models.StoreConfig]:
    r = await db.execute(
        select(models.StoreConfig).where(
            and_(models.StoreConfig.company_id == company_id, models.StoreConfig.branch_id == branch_id)
        )
    )
    return r.scalar_one_or_none()


async def upsert_store_config(db: AsyncSession, company_id: UUID, data: schemas.StoreConfigCreate) -> models.StoreConfig:
    existing = await get_store_config(db, company_id, data.branch_id)
    if existing:
        for k, v in data.model_dump(exclude={"branch_id"}).items():
            setattr(existing, k, v)
        await db.commit()
        await db.refresh(existing)
        return existing
    cfg = models.StoreConfig(company_id=company_id, **data.model_dump())
    db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return cfg


# ════════════════════════════════════════════════════════════
#  KPI / DASHBOARD
# ════════════════════════════════════════════════════════════

async def _build_kpi_snapshot(
    db: AsyncSession, company_id: UUID, branch_id: Optional[UUID], fecha: date, periodo: str
) -> schemas.KpiSnapshotResponse:
    """Build KPI snapshot aggregating real sales data."""

    # Date range
    if periodo == "dia":
        start = datetime.combine(fecha, datetime.min.time())
        end = start + timedelta(days=1)
    elif periodo == "semana":
        start = datetime.combine(fecha - timedelta(days=fecha.weekday()), datetime.min.time())
        end = start + timedelta(days=7)
    else:  # mes
        start = datetime.combine(fecha.replace(day=1), datetime.min.time())
        if fecha.month == 12:
            end = datetime.combine(fecha.replace(year=fecha.year + 1, month=1, day=1), datetime.min.time())
        else:
            end = datetime.combine(fecha.replace(month=fecha.month + 1, day=1), datetime.min.time())

    # Try to query real sales (Sale model from sales module)
    ventas_total = Decimal("0")
    ventas_count = 0
    clientes_unicos = 0
    productos_vendidos = 0
    descuento_total = Decimal("0")

    try:
        from api.src.sales.models import Sale, SaleItem

        q = select(
            func.coalesce(func.sum(Sale.total), 0).label("ventas"),
            func.count(Sale.id).label("count"),
            func.count(func.distinct(Sale.customer_id)).label("clientes"),
            func.coalesce(func.sum(Sale.descuento_total), 0).label("descuentos"),
        ).where(
            and_(
                Sale.company_id == company_id,
                Sale.fecha >= start,
                Sale.fecha < end,
                Sale.estado == "confirmado",
            )
        )
        if branch_id:
            q = q.where(Sale.branch_id == branch_id)

        r = await db.execute(q)
        row = r.one()
        ventas_total = Decimal(str(row.ventas or 0))
        ventas_count = row.count or 0
        clientes_unicos = row.clientes or 0
        descuento_total = Decimal(str(row.descuentos or 0))

        # Count products
        qi = select(func.coalesce(func.sum(SaleItem.cantidad), 0)).join(Sale).where(
            and_(Sale.company_id == company_id, Sale.fecha >= start, Sale.fecha < end)
        )
        if branch_id:
            qi = qi.where(Sale.branch_id == branch_id)
        ri = await db.execute(qi)
        productos_vendidos = int(ri.scalar() or 0)
    except Exception:
        # Modulo de ventas no disponible — se devuelve el snapshot en cero,
        # sin inventar numeros (antes caia a un fallback sintetico via MD5).
        pass

    ticket_promedio = ventas_total / Decimal(ventas_count) if ventas_count else Decimal("0")

    # Sales/m²
    m2 = Decimal("0")
    if branch_id:
        cfg = await get_store_config(db, company_id, branch_id)
        if cfg and cfg.metros_cuadrados:
            m2 = cfg.metros_cuadrados
    ventas_m2 = ventas_total / m2 if m2 else Decimal("0")

    # Delta vs previous period (incluye clientes, simetrico a delta_ventas/ticket)
    prev_start = start - (end - start)
    prev_end = start
    delta_ventas_pct = Decimal("0")
    delta_ticket_pct = Decimal("0")
    delta_clientes_pct = Decimal("0")
    try:
        from api.src.sales.models import Sale
        qp = select(
            func.coalesce(func.sum(Sale.total), 0),
            func.count(Sale.id),
            func.count(func.distinct(Sale.customer_id)),
        ).where(
            and_(Sale.company_id == company_id, Sale.fecha >= prev_start, Sale.fecha < prev_end,
                 Sale.estado == "confirmado")
        )
        if branch_id:
            qp = qp.where(Sale.branch_id == branch_id)
        rp = await db.execute(qp)
        prev_ventas, prev_count, prev_clientes = rp.one()
        prev_ventas = Decimal(str(prev_ventas or 0))
        prev_count = prev_count or 0
        prev_clientes = prev_clientes or 0
        prev_ticket = prev_ventas / Decimal(prev_count) if prev_count else Decimal("0")
        delta_ventas_pct = ((ventas_total - prev_ventas) / prev_ventas * 100) if prev_ventas else Decimal("0")
        delta_ticket_pct = ((ticket_promedio - prev_ticket) / prev_ticket * 100) if prev_ticket else Decimal("0")
        delta_clientes_pct = ((Decimal(clientes_unicos) - prev_clientes) / prev_clientes * 100) if prev_clientes else Decimal("0")
    except Exception:
        pass

    # Hora pico real: la hora con mas ventas dentro del periodo
    hora_pico = None
    hora_pico_ventas = Decimal("0")
    try:
        from api.src.sales.models import Sale
        qh = select(
            func.extract("hour", Sale.fecha).label("hora"),
            func.coalesce(func.sum(Sale.total), 0).label("ventas"),
        ).where(
            and_(Sale.company_id == company_id, Sale.fecha >= start, Sale.fecha < end, Sale.estado == "confirmado")
        )
        if branch_id:
            qh = qh.where(Sale.branch_id == branch_id)
        qh = qh.group_by(func.extract("hour", Sale.fecha)).order_by(desc("ventas")).limit(1)
        rh = await db.execute(qh)
        top_hora = rh.first()
        if top_hora:
            hora_pico = int(top_hora.hora)
            hora_pico_ventas = Decimal(str(top_hora.ventas))
    except Exception:
        pass

    # Margen bruto real: ingreso de items menos su costo unitario real (no un % asumido)
    margen_bruto = Decimal("0")
    try:
        from api.src.sales.models import Sale, SaleItem
        qm = select(
            func.coalesce(func.sum(SaleItem.total), 0),
            func.coalesce(func.sum(SaleItem.costo_unitario * SaleItem.cantidad), 0),
        ).select_from(SaleItem).join(Sale, Sale.id == SaleItem.sale_id).where(
            and_(Sale.company_id == company_id, Sale.fecha >= start, Sale.fecha < end, Sale.estado == "confirmado")
        )
        if branch_id:
            qm = qm.where(Sale.branch_id == branch_id)
        rm = await db.execute(qm)
        ingreso_items, costo_items = rm.one()
        margen_bruto = Decimal(str(ingreso_items or 0)) - Decimal(str(costo_items or 0))
    except Exception:
        pass

    # Conversion (visitas -> ventas) requiere conteo de trafico real (sensor/camara
    # en la entrada) que este cliente no tiene integrado -- no hay forma honesta
    # de calcularlo, se deja sin dato en vez de inventar un numero.
    conversion_pct = None

    return schemas.KpiSnapshotResponse(
        fecha=fecha,
        periodo=periodo,
        ventas_total=ventas_total,
        ventas_count=ventas_count,
        ticket_promedio=ticket_promedio,
        ventas_m2=ventas_m2,
        margen_bruto=margen_bruto,
        clientes_unicos=clientes_unicos,
        productos_vendidos=productos_vendidos,
        descuento_total=descuento_total,
        delta_ventas_pct=delta_ventas_pct.quantize(Decimal("0.01")),
        delta_ticket_pct=delta_ticket_pct.quantize(Decimal("0.01")),
        delta_clientes_pct=delta_clientes_pct,
        hora_pico=hora_pico,
        hora_pico_ventas=hora_pico_ventas,
        conversion_pct=conversion_pct,
        payload={},
    )


async def build_dashboard(
    db: AsyncSession, company_id: UUID, branch_id: Optional[UUID] = None
) -> schemas.RetailDashboardData:
    today = date.today()
    hoy = await _build_kpi_snapshot(db, company_id, branch_id, today, "dia")
    semana = await _build_kpi_snapshot(db, company_id, branch_id, today, "semana")
    mes = await _build_kpi_snapshot(db, company_id, branch_id, today, "mes")

    # Heatmap 7 dias x 24 horas — antes era enteramente sintetico (seed MD5),
    # ahora agrega Sale real por dia+hora de la semana en curso.
    heatmap: List[schemas.HourHeatmapResponse] = []
    ventas_por_dia_semana = []
    dias_nombre = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    semana_inicio = today - timedelta(days=today.weekday())
    semana_fin = semana_inicio + timedelta(days=7)

    real_por_dia_hora: dict = {}
    try:
        from api.src.sales.models import Sale
        qh = select(
            func.date(Sale.fecha).label("dia"),
            func.extract("hour", Sale.fecha).label("hora"),
            func.coalesce(func.sum(Sale.total), 0).label("ventas"),
            func.count(Sale.id).label("count"),
            func.count(func.distinct(Sale.customer_id)).label("clientes"),
        ).where(
            and_(
                Sale.company_id == company_id,
                Sale.fecha >= semana_inicio,
                Sale.fecha < semana_fin,
                Sale.estado == "confirmado",
            )
        )
        if branch_id:
            qh = qh.where(Sale.branch_id == branch_id)
        qh = qh.group_by(func.date(Sale.fecha), func.extract("hour", Sale.fecha))
        rh = await db.execute(qh)
        for row in rh.all():
            real_por_dia_hora[(row.dia, int(row.hora))] = row
    except Exception:
        pass

    for d in range(7):
        fecha_d = semana_inicio + timedelta(days=d)
        total_dia = Decimal("0")
        count_dia = 0
        for h in range(24):
            row = real_por_dia_hora.get((fecha_d, h))
            ventas_h = Decimal(str(row.ventas)) if row else Decimal("0")
            count_h = row.count if row else 0
            clientes_h = row.clientes if row else 0
            # Personal sugerido segun capacidad real (1 cajero cada 4 ventas/hora)
            personal = max(1, count_h // 4) if count_h else 0
            heatmap.append(schemas.HourHeatmapResponse(
                fecha=fecha_d, hora=h, ventas_total=ventas_h, ventas_count=count_h,
                clientes_count=clientes_h, duracion_promedio_min=0, personal_sugerido=personal
            ))
            total_dia += ventas_h
            count_dia += count_h
        ventas_por_dia_semana.append({
            "dia": dias_nombre[d], "fecha": str(fecha_d), "ventas": float(total_dia), "count": count_dia
        })

    # Top productos
    top_productos = []
    try:
        from api.src.sales.models import SaleItem, Sale
        from api.src.products.models import Product
        q = (
            select(
                Product.id, Product.nombre, Product.sku, Product.codigo_barra,
                func.sum(SaleItem.cantidad).label("qty"),
                func.sum(SaleItem.total).label("total"),
            )
            .join(SaleItem, SaleItem.product_id == Product.id)
            .join(Sale, Sale.id == SaleItem.sale_id)
            .where(and_(Sale.company_id == company_id, Sale.fecha >= today - timedelta(days=30)))
            .group_by(Product.id, Product.nombre, Product.sku, Product.codigo_barra)
            .order_by(desc("total"))
            .limit(20)
        )
        if branch_id:
            q = q.where(Sale.branch_id == branch_id)
        r = await db.execute(q)
        for row in r.all():
            top_productos.append({
                "id": str(row.id), "nombre": row.nombre, "codigo": row.sku,
                "codigo_barra": row.codigo_barra, "cantidad": int(row.qty or 0),
                "total": float(row.total or 0),
            })
    except Exception:
        pass

    # Stock real vive en inventory.Stock (por deposito), no en Product — antes
    # se leia un Product.stock_actual que no existe en el modelo, por lo que
    # esta seccion caia siempre al catch generico y mostraba datos inventados.
    stock_por_producto = {}
    try:
        from api.src.inventory.models import Stock
        qs = select(Stock.product_id, func.coalesce(func.sum(Stock.cantidad), 0).label("total")).group_by(Stock.product_id)
        rs = await db.execute(qs)
        stock_por_producto = {row.product_id: row.total for row in rs.all()}
    except Exception:
        pass

    # Productos sin venta (rotación lenta)
    sin_venta = []
    try:
        from api.src.sales.models import SaleItem, Sale
        from api.src.products.models import Product
        q = (
            select(Product.id, Product.nombre, Product.sku, Product.precio_venta)
            .outerjoin(SaleItem, SaleItem.product_id == Product.id)
            .outerjoin(Sale, and_(Sale.id == SaleItem.sale_id, Sale.fecha >= today - timedelta(days=30)))
            .where(and_(Product.company_id == company_id, Product.activo == True, SaleItem.id.is_(None)))
            .limit(20)
        )
        r = await db.execute(q)
        for row in r.all():
            sin_venta.append({
                "id": str(row.id), "nombre": row.nombre, "codigo": row.sku,
                "stock": float(stock_por_producto.get(row.id, 0)), "precio": float(row.precio_venta or 0),
            })
    except Exception:
        pass

    # Alertas stock
    alertas = []
    try:
        from api.src.products.models import Product
        q = select(Product.id, Product.nombre, Product.sku, Product.stock_minimo).where(
            and_(Product.company_id == company_id, Product.activo == True)
        )
        r = await db.execute(q)
        for row in r.all():
            stock_real = stock_por_producto.get(row.id, 0)
            if stock_real <= (row.stock_minimo or 0):
                alertas.append({
                    "id": str(row.id), "nombre": row.nombre, "codigo": row.sku,
                    "stock_actual": float(stock_real), "stock_minimo": float(row.stock_minimo or 0)
                })
                if len(alertas) >= 10:
                    break
    except Exception:
        pass

    # Próximos eventos (próximos 90 días)
    prox = []
    try:
        q = select(models.CalendarEvent).where(
            and_(models.CalendarEvent.company_id == company_id, models.CalendarEvent.activo == True)
        )
        r = await db.execute(q)
        events = r.scalars().all()
        for ev in events:
            ev_date = ev.fecha_evento
            if ev_date < today:
                ev_date = ev_date.replace(year=today.year + 1)
            if 0 <= (ev_date - today).days <= 90:
                prox.append(schemas.CalendarEventResponse(
                    id=ev.id, company_id=ev.company_id, codigo=ev.codigo, nombre=ev.nombre,
                    descripcion=ev.descripcion, fecha_evento=ev.fecha_evento, fecha_fin=ev.fecha_fin,
                    categoria=ev.categoria, icono=ev.icono, recurrente=ev.recurrente,
                    notas_planificacion=ev.notas_planificacion, activo=ev.activo, created_at=ev.created_at,
                    promos_count=0
                ))
        prox.sort(key=lambda e: e.fecha_evento)
    except Exception:
        pass

    # Cupones activos
    cupones_count = 0
    try:
        q = select(func.count(models.Coupon.id)).where(
            and_(models.Coupon.company_id == company_id, models.Coupon.estado == "activo")
        )
        r = await db.execute(q)
        cupones_count = int(r.scalar() or 0)
    except Exception:
        pass

    # Comparativa — mejor dia/hora de la semana calculados sobre el heatmap real recien armado
    mejor_dia = max(ventas_por_dia_semana, key=lambda d: d["ventas"], default=None) if any(d["ventas"] for d in ventas_por_dia_semana) else None
    mejor_hora_h = max(heatmap, key=lambda h: h.ventas_total, default=None) if heatmap and any(h.ventas_total for h in heatmap) else None
    comparativa = {
        "vs_ayer": {
            "ventas_pct": float(hoy.delta_ventas_pct),
            "ticket_pct": float(hoy.delta_ticket_pct),
            "clientes_pct": float(hoy.delta_clientes_pct),
        },
        "mejor_dia_semana": mejor_dia["dia"] if mejor_dia else None,
        "mejor_hora": f"{mejor_hora_h.hora}:00" if mejor_hora_h else None,
        "producto_estrella": top_productos[0]["nombre"] if top_productos else "N/A",
    }

    return schemas.RetailDashboardData(
        hoy=hoy, semana=semana, mes=mes,
        heatmap_7dias=heatmap,
        top_productos=top_productos,
        productos_sin_venta=sin_venta,
        alertas_stock=alertas,
        proximos_eventos=prox[:5],
        cupones_activos=cupones_count,
        ventas_por_dia_semana=ventas_por_dia_semana,
        comparativa=comparativa,
        generated_at=_utcnow(),
    )


# ════════════════════════════════════════════════════════════
#  COUPONS
# ════════════════════════════════════════════════════════════

def _generate_coupon_code(prefix: str = "") -> str:
    chars = string.ascii_uppercase + string.digits
    code = "".join(secrets.choice(chars) for _ in range(8))
    return f"{prefix}{code}" if prefix else code


async def create_coupon(db: AsyncSession, company_id: UUID, data: schemas.CouponCreate, user_id: Optional[UUID] = None) -> models.Coupon:
    # If no code provided, generate
    codigo = data.codigo
    if not codigo or codigo == "AUTO":
        codigo = _generate_coupon_code()

    c = models.Coupon(
        company_id=company_id,
        codigo=codigo,
        nombre=data.nombre,
        descripcion=data.descripcion,
        tipo=data.tipo,
        valor=data.valor,
        compra_minima=data.compra_minima,
        segmento_id=data.segmento_id,
        segmento_nombre=data.segmento_nombre,
        clientes_target=data.clientes_target,
        aplicar_a=data.aplicar_a,
        categorias_ids=[str(x) for x in data.categorias_ids],
        productos_ids=[str(x) for x in data.productos_ids],
        fecha_desde=data.fecha_desde,
        fecha_hasta=data.fecha_hasta,
        usos_maximos=data.usos_maximos,
        usos_por_cliente=data.usos_por_cliente,
        canal=data.canal,
        created_by=user_id,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


async def list_coupons(
    db: AsyncSession, company_id: UUID, estado: Optional[str] = None, limit: int = 100
) -> List[models.Coupon]:
    q = select(models.Coupon).where(models.Coupon.company_id == company_id)
    if estado:
        q = q.where(models.Coupon.estado == estado)
    q = q.order_by(desc(models.Coupon.created_at)).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


async def get_coupon(db: AsyncSession, coupon_id: UUID) -> Optional[models.Coupon]:
    r = await db.execute(select(models.Coupon).where(models.Coupon.id == coupon_id))
    return r.scalar_one_or_none()


async def update_coupon(db: AsyncSession, coupon_id: UUID, data: schemas.CouponUpdate) -> models.Coupon:
    c = await get_coupon(db, coupon_id)
    if not c:
        raise HTTPException(404, "Cupón no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return c


async def validate_coupon(
    db: AsyncSession, company_id: UUID, data: schemas.CouponValidateRequest
) -> schemas.CouponValidateResponse:
    """Validate coupon and return applied discount."""
    r = await db.execute(
        select(models.Coupon).where(
            and_(models.Coupon.company_id == company_id, models.Coupon.codigo == data.codigo.upper())
        )
    )
    c = r.scalar_one_or_none()
    if not c:
        return schemas.CouponValidateResponse(valido=False, mensaje=f"Cupón '{data.codigo}' no existe")
    if c.estado != "activo":
        return schemas.CouponValidateResponse(valido=False, cupon=schemas.CouponResponse.model_validate(c), mensaje=f"Cupón {c.estado}")
    now = _utcnow()
    if c.fecha_desde > now:
        return schemas.CouponValidateResponse(valido=False, cupon=schemas.CouponResponse.model_validate(c), mensaje="Cupón aún no vigente")
    if c.fecha_hasta < now:
        return schemas.CouponValidateResponse(valido=False, cupon=schemas.CouponResponse.model_validate(c), mensaje="Cupón expirado")
    if c.usos_maximos > 0 and c.usos_actuales >= c.usos_maximos:
        return schemas.CouponValidateResponse(valido=False, cupon=schemas.CouponResponse.model_validate(c), mensaje="Cupón agotado")
    if data.monto_compra < c.compra_minima:
        return schemas.CouponValidateResponse(
            valido=False, cupon=schemas.CouponResponse.model_validate(c),
            mensaje=f"Compra mínima: {c.compra_minima}"
        )
    # Calculate discount
    if c.tipo == "porcentaje":
        descuento = data.monto_compra * (c.valor / Decimal("100"))
    elif c.tipo == "monto_fijo":
        descuento = c.valor
    else:
        descuento = Decimal("0")
    descuento = min(descuento, data.monto_compra)

    return schemas.CouponValidateResponse(
        valido=True, cupon=schemas.CouponResponse.model_validate(c),
        descuento_aplicado=descuento, mensaje="Cupón aplicable"
    )


async def redeem_coupon(
    db: AsyncSession, company_id: UUID, coupon_id: UUID, customer_id: Optional[UUID],
    sale_id: Optional[UUID], branch_id: Optional[UUID], descuento: Decimal, vendedor: Optional[str] = None
) -> models.CouponRedemption:
    c = await get_coupon(db, coupon_id)
    if not c:
        raise HTTPException(404, "Cupón no encontrado")
    c.usos_actuales += 1
    if c.usos_maximos > 0 and c.usos_actuales >= c.usos_maximos:
        c.estado = "agotado"
    red = models.CouponRedemption(
        company_id=company_id, coupon_id=coupon_id, customer_id=customer_id,
        sale_id=sale_id, branch_id=branch_id, monto_descuento=descuento, vendedor=vendedor
    )
    db.add(red)
    await db.commit()
    await db.refresh(red)
    return red


async def coupons_dashboard(db: AsyncSession, company_id: UUID) -> Dict[str, Any]:
    """Aggregate coupon stats for dashboard."""
    q = select(
        func.count(models.Coupon.id).label("total"),
        func.sum(func.case((models.Coupon.estado == "activo", 1), else_=0)).label("activos"),
        func.sum(func.case((models.Coupon.estado == "expirado", 1), else_=0)).label("expirados"),
        func.sum(func.case((models.Coupon.estado == "agotado", 1), else_=0)).label("agotados"),
    ).where(models.Coupon.company_id == company_id)
    r = await db.execute(q)
    row = r.one()
    total = row.total or 0
    activos = row.activos or 0

    # Redemptions
    q2 = select(
        func.count(models.CouponRedemption.id).label("canjes"),
        func.coalesce(func.sum(models.CouponRedemption.monto_descuento), 0).label("descuento_total"),
    ).where(models.CouponRedemption.company_id == company_id)
    r2 = await db.execute(q2)
    row2 = r2.one()

    return {
        "total_coupons": total,
        "activos": activos,
        "expirados": row.expirados or 0,
        "agotados": row.agotados or 0,
        "canjes": row2.canjes or 0,
        "descuento_total": float(row2.descuento_total or 0),
        "tasa_canje_pct": round((row2.canjes or 0) / max(total, 1) * 100, 1),
        "roi_estimado": 4.2,
    }


# ════════════════════════════════════════════════════════════
#  CALENDAR EVENTS (Paraguay-aware)
# ════════════════════════════════════════════════════════════

async def seed_py_calendar(db: AsyncSession, company_id: UUID) -> List[models.CalendarEvent]:
    """Idempotent: seed the 15 PY events if missing."""
    created = []
    for ev in PY_CALENDAR_2026:
        r = await db.execute(
            select(models.CalendarEvent).where(
                and_(models.CalendarEvent.company_id == company_id, models.CalendarEvent.codigo == ev["codigo"])
            )
        )
        existing = r.scalar_one_or_none()
        if not existing:
            ev_copy = dict(ev)
            if isinstance(ev_copy.get("fecha_evento"), str):
                ev_copy["fecha_evento"] = date.fromisoformat(ev_copy["fecha_evento"])
            if isinstance(ev_copy.get("fecha_fin"), str):
                ev_copy["fecha_fin"] = date.fromisoformat(ev_copy["fecha_fin"])
            ce = models.CalendarEvent(company_id=company_id, **ev_copy)
            db.add(ce)
            created.append(ce)
    if created:
        await db.commit()
    return created


async def list_events(
    db: AsyncSession, company_id: UUID, year: Optional[int] = None
) -> List[schemas.CalendarEventResponse]:
    q = select(models.CalendarEvent).where(models.CalendarEvent.company_id == company_id)
    if year:
        q = q.where(func.extract("year", models.CalendarEvent.fecha_evento) == year)
    q = q.order_by(asc(models.CalendarEvent.fecha_evento))
    r = await db.execute(q)
    events = r.scalars().all()
    # count promos
    results = []
    for ev in events:
        pc = await db.execute(
            select(func.count(models.EventPromo.id)).where(models.EventPromo.event_id == ev.id)
        )
        promos = pc.scalar() or 0
        results.append(schemas.CalendarEventResponse(
            id=ev.id, company_id=ev.company_id, codigo=ev.codigo, nombre=ev.nombre,
            descripcion=ev.descripcion, fecha_evento=ev.fecha_evento, fecha_fin=ev.fecha_fin,
            categoria=ev.categoria, icono=ev.icono, recurrente=ev.recurrente,
            notas_planificacion=ev.notas_planificacion, activo=ev.activo, created_at=ev.created_at,
            promos_count=promos
        ))
    return results


async def get_event(db: AsyncSession, event_id: UUID) -> Optional[models.CalendarEvent]:
    r = await db.execute(select(models.CalendarEvent).where(models.CalendarEvent.id == event_id))
    return r.scalar_one_or_none()


async def suggest_event_promos(db: AsyncSession, company_id: UUID, event_id: UUID) -> Dict[str, Any]:
    """AI-style suggestion: based on event, suggest category and lift."""
    ev = await get_event(db, event_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    info = PRODUCTOS_POR_EVENTO.get(ev.codigo, {})
    return {
        "evento": ev.nombre,
        "fecha": str(ev.fecha_evento),
        "categorias_sugeridas": info.get("categorias", []),
        "lift_historico_pct": info.get("lift_pct", 25),
        "margen_sugerido_pct": info.get("margen_sugerido", 30),
        "copy_sugerido": f"🎉 {ev.nombre}! Aprovechá descuentos especiales en {', '.join(info.get('categorias', ['productos seleccionados']))[:60]}. Válido por tiempo limitado.",
        "presupuesto_sugerido": 1500000,  # 1.5M PYG
    }


async def create_event(db: AsyncSession, company_id: UUID, data: schemas.CalendarEventCreate) -> models.CalendarEvent:
    ev = models.CalendarEvent(company_id=company_id, **data.model_dump())
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return ev


async def update_event(db: AsyncSession, event_id: UUID, data: schemas.CalendarEventUpdate) -> models.CalendarEvent:
    ev = await get_event(db, event_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(ev, k, v)
    await db.commit()
    await db.refresh(ev)
    return ev


# ── Event Promos ────────────────────────────────────────────

async def list_event_promos(
    db: AsyncSession, company_id: UUID, event_id: Optional[UUID] = None, estado: Optional[str] = None
) -> List[schemas.EventPromoResponse]:
    q = select(models.EventPromo, models.CalendarEvent).outerjoin(
        models.CalendarEvent, models.CalendarEvent.id == models.EventPromo.event_id
    ).where(models.EventPromo.company_id == company_id)
    if event_id:
        q = q.where(models.EventPromo.event_id == event_id)
    if estado:
        q = q.where(models.EventPromo.estado == estado)
    q = q.order_by(asc(models.EventPromo.fecha_desde))
    r = await db.execute(q)
    out = []
    for promo, ev in r.all():
        out.append(schemas.EventPromoResponse(
            id=promo.id, company_id=promo.company_id, event_id=promo.event_id,
            nombre=promo.nombre, tipo=promo.tipo, valor=promo.valor,
            fecha_desde=promo.fecha_desde, fecha_hasta=promo.fecha_hasta,
            productos_ids=promo.productos_ids or [], categorias_ids=promo.categorias_ids or [],
            bundle_config=promo.bundle_config or {}, presupuesto=promo.presupuesto,
            inversion_marketing=promo.inversion_marketing, copy_sugerido=promo.copy_sugerido,
            notas=promo.notas, estado=promo.estado, ventas_atribuidas=promo.ventas_atribuidas,
            roi_pct=promo.roi_pct, created_at=promo.created_at, updated_at=promo.updated_at,
            event_nombre=ev.nombre if ev else None, event_icono=ev.icono if ev else None
        ))
    return out


async def create_event_promo(db: AsyncSession, company_id: UUID, data: schemas.EventPromoCreate) -> models.EventPromo:
    p = models.EventPromo(company_id=company_id, **data.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def update_event_promo(db: AsyncSession, promo_id: UUID, data: schemas.EventPromoUpdate) -> models.EventPromo:
    r = await db.execute(select(models.EventPromo).where(models.EventPromo.id == promo_id))
    p = r.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Promo no encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    # recalc ROI
    if p.inversion_marketing and p.ventas_atribuidas:
        try:
            inv = Decimal(str(p.inversion_marketing))
            va = Decimal(str(p.ventas_atribuidas))
            if inv > 0:
                p.roi_pct = (va - inv) / inv * 100
        except Exception:
            pass
    await db.commit()
    await db.refresh(p)
    return p


# ════════════════════════════════════════════════════════════
#  POS CASH SESSIONS
# ════════════════════════════════════════════════════════════

async def open_cash_session(db: AsyncSession, company_id: UUID, data: schemas.CashSessionOpen, user_id: UUID, user_name: str) -> models.CashSession:
    # Close any open session for user/branch
    r = await db.execute(
        select(models.CashSession).where(
            and_(
                models.CashSession.company_id == company_id,
                models.CashSession.branch_id == data.branch_id,
                models.CashSession.usuario_id == user_id,
                models.CashSession.estado == "abierta",
            )
        )
    )
    existing = r.scalar_one_or_none()
    if existing:
        return existing

    cs = models.CashSession(
        company_id=company_id, branch_id=data.branch_id, usuario_id=user_id,
        usuario_nombre=user_name, monto_apertura=data.monto_apertura, notas=data.notas
    )
    db.add(cs)
    await db.commit()
    await db.refresh(cs)
    return cs


async def close_cash_session(db: AsyncSession, session_id: UUID, data: schemas.CashSessionClose) -> models.CashSession:
    r = await db.execute(select(models.CashSession).where(models.CashSession.id == session_id))
    cs = r.scalar_one_or_none()
    if not cs:
        raise HTTPException(404, "Sesión no encontrada")
    if cs.estado != "abierta":
        raise HTTPException(400, "La sesión ya está cerrada")
    cs.monto_cierre = data.monto_cierre
    cs.movimientos = data.movimientos
    cs.fecha_cierre = _utcnow()
    cs.diferencia = data.monto_cierre - (cs.monto_teorico or Decimal("0"))
    cs.estado = "cerrada"
    cs.notas = data.notas
    await db.commit()
    await db.refresh(cs)
    return cs


async def get_open_session(db: AsyncSession, company_id: UUID, branch_id: UUID, user_id: UUID) -> Optional[models.CashSession]:
    r = await db.execute(
        select(models.CashSession).where(
            and_(
                models.CashSession.company_id == company_id,
                models.CashSession.branch_id == branch_id,
                models.CashSession.usuario_id == user_id,
                models.CashSession.estado == "abierta",
            )
        )
    )
    return r.scalar_one_or_none()


# ════════════════════════════════════════════════════════════
#  QUICK CUSTOMER
# ════════════════════════════════════════════════════════════

async def quick_customer_lookup(
    db: AsyncSession, company_id: UUID, data: schemas.QuickCustomerLookup
) -> schemas.QuickCustomerResult:
    """Sub-200ms lookup by phone/DNI/RUC/QR."""
    ident = data.identificador.strip()
    tipo = data.tipo
    # Auto-detect type
    if tipo == "auto":
        if ident.startswith("+") or ident.replace(" ", "").isdigit() and len(ident) >= 8:
            tipo = "telefono"
        elif ident.isdigit() and len(ident) <= 10:
            tipo = "dni"
        elif ident.isdigit() and len(ident) > 10:
            tipo = "ruc"
        else:
            tipo = "qr"

    customer_id = None
    customer_nombre = None
    telefono = None

    # Try lookup in customers
    try:
        from api.src.customers.models import Customer
        q = select(Customer).where(Customer.company_id == company_id)
        if tipo == "telefono":
            phone_clean = ident.replace("+595", "").replace(" ", "").replace("-", "")
            q = q.where(or_(Customer.telefono.ilike(f"%{ident}%"), Customer.telefono.ilike(f"%{phone_clean}%")))
        elif tipo == "dni":
            q = q.where(Customer.ruc.ilike(f"%{ident}%"))
        elif tipo == "ruc":
            q = q.where(Customer.ruc == ident)
        q = q.limit(1)
        r = await db.execute(q)
        cust = r.scalar_one_or_none()
        if cust:
            customer_id = cust.id
            customer_nombre = cust.nombre
            telefono = cust.telefono
    except Exception:
        pass

    if not customer_id:
        # Antes se inventaba un cliente con nombre al azar (ej. "Juan Pérez")
        # cada vez que no habia match — eso podia terminar asociado a una
        # venta real. Ahora se informa honestamente que no se encontro.
        return schemas.QuickCustomerResult(
            encontrado=False,
            customer_id=None,
            nombre=None,
            telefono=None,
            puntos=0,
            segmento=None,
            proxima_recompensa=None,
            descuento_aplicable=Decimal("0"),
            sugerencias=["Cliente no encontrado — registrar como nuevo si corresponde"],
            mensaje="Cliente no encontrado",
        )

    # Puntos reales: 1 punto por cada Gs 10.000 comprados historicamente (no
    # una gamificacion inventada por hash del identificador).
    puntos = 0
    try:
        from api.src.sales.models import Sale
        qt = select(func.coalesce(func.sum(Sale.total), 0)).where(
            and_(Sale.company_id == company_id, Sale.customer_id == customer_id, Sale.estado == "confirmado")
        )
        rt = await db.execute(qt)
        total_historico = Decimal(str(rt.scalar() or 0))
        puntos = int(total_historico / Decimal("10000"))
    except Exception:
        pass

    if puntos > 20000:
        segmento = "VIP"
        recompensa = "🎁 Regalo en próxima compra"
    elif puntos > 8000:
        segmento = "Frecuente"
        recompensa = "💎 15% descuento en próxima compra"
    elif puntos > 1000:
        segmento = "Regular"
        recompensa = "⭐ Acumula más puntos para tu próximo descuento"
    else:
        segmento = "Nuevo"
        recompensa = "🎉 Bienvenido, 5% descuento en tu primera compra"

    descuento = Decimal("0")
    if segmento == "VIP":
        descuento = Decimal("100000")
    elif segmento == "Frecuente":
        descuento = Decimal("50000")
    elif segmento == "Nuevo":
        descuento = Decimal("20000")

    # Sugerencias contextuales
    sugerencias = [
        f"Cliente {segmento}, ofrecer {recompensa.lower()}",
    ]
    if segmento in ("VIP", "Frecuente"):
        sugerencias.append("Aplicar cupón automático de fidelización")
        sugerencias.append("Preguntar si quiere participar en próxima promo")

    # Log the lookup
    log = models.QuickCustomerLog(
        company_id=company_id,
        identificador=ident,
        tipo=tipo,
        customer_id=customer_id,
        customer_nombre=customer_nombre,
        puntos=puntos,
        segmento=segmento,
        proxima_recompensa=recompensa,
        descuento_aplicable=descuento,
    )
    db.add(log)
    await db.commit()

    return schemas.QuickCustomerResult(
        encontrado=True,
        customer_id=customer_id,
        nombre=customer_nombre,
        telefono=telefono,
        puntos=puntos,
        segmento=segmento,
        proxima_recompensa=recompensa,
        descuento_aplicable=descuento,
        sugerencias=sugerencias,
        mensaje=f"Cliente identificado como {segmento}",
    )


# ════════════════════════════════════════════════════════════
#  ONLINE STOREFRONT
# ════════════════════════════════════════════════════════════

async def get_storefront(db: AsyncSession, company_id: UUID, branch_id: UUID) -> Optional[models.OnlineStorefront]:
    r = await db.execute(
        select(models.OnlineStorefront).where(
            and_(models.OnlineStorefront.company_id == company_id, models.OnlineStorefront.branch_id == branch_id)
        )
    )
    return r.scalar_one_or_none()


async def get_storefront_by_slug(db: AsyncSession, slug: str) -> Optional[models.OnlineStorefront]:
    r = await db.execute(select(models.OnlineStorefront).where(models.OnlineStorefront.slug == slug))
    return r.scalar_one_or_none()


async def upsert_storefront(
    db: AsyncSession, company_id: UUID, data: schemas.OnlineStorefrontCreate
) -> models.OnlineStorefront:
    existing = await get_storefront(db, company_id, data.branch_id)
    if existing:
        for k, v in data.model_dump(exclude={"branch_id", "slug"}).items():
            setattr(existing, k, v)
        await db.commit()
        await db.refresh(existing)
        return existing
    sf = models.OnlineStorefront(company_id=company_id, **data.model_dump())
    db.add(sf)
    await db.commit()
    await db.refresh(sf)
    return sf


async def update_storefront(
    db: AsyncSession, storefront_id: UUID, data: schemas.OnlineStorefrontUpdate
) -> models.OnlineStorefront:
    r = await db.execute(select(models.OnlineStorefront).where(models.OnlineStorefront.id == storefront_id))
    sf = r.scalar_one_or_none()
    if not sf:
        raise HTTPException(404, "Tienda no encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(sf, k, v)
    await db.commit()
    await db.refresh(sf)
    return sf
