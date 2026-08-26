"""Sales service"""

from sqlalchemy import select, update, func, cast, Integer, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from api.src.sales.models import Sale, SaleItem, SalePayment
from api.src.auth.models import User
from api.src.sales.schemas import SaleCreate, SaleUpdate, SaleAddPayment
from api.src.inventory.models import Stock, StockLot, InventoryMovement
from api.src.fiscal import service as fiscal_service


def calculate_taxes(item: dict) -> dict:
    precio = Decimal(str(item["precio_unitario"]))
    cantidad = Decimal(str(item["cantidad"]))
    descuento_pct = Decimal(str(item.get("descuento_pct", 0)))
    iva_tasa = Decimal(str(item.get("iva_tasa", 10)))

    subtotal_bruto = precio * cantidad
    descuento_monto = subtotal_bruto * (descuento_pct / Decimal("100"))
    # El precio de venta en Paraguay ya viene con el IVA incluido (precio de
    # gondola/vidriera) -- esta funcion trataba precio_unitario como una
    # base SIN IVA y le sumaba el impuesto encima, inflando ~9-10% el total
    # de CADA venta por sobre lo que el cliente realmente pagaba (el modal
    # de cobro ya cobraba el monto correcto -- era el total grabado en la
    # base, la liquidacion de IVA y lo que iria a SIFEN lo que quedaba mal).
    # Ahora el IVA se EXTRAE del precio ya incluido, no se agrega de nuevo.
    total = (subtotal_bruto - descuento_monto).quantize(Decimal("1"), rounding="ROUND_HALF_UP")

    if iva_tasa == Decimal("0"):
        iva_monto = Decimal("0")
        base = total
    else:
        base = (total / (Decimal("1") + iva_tasa / Decimal("100"))).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
        iva_monto = total - base

    return {
        "subtotal_bruto": subtotal_bruto.quantize(Decimal("1")),
        "descuento_monto": descuento_monto.quantize(Decimal("1")),
        "iva_monto": iva_monto,
        "total": total,
        "base": base,
    }


async def generate_sale_number(db: AsyncSession, company_id: str, branch_id: str | None) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(Sale)
        .where(Sale.company_id == company_id)
        .order_by(Sale.created_at.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    branch_code = branch_id[:3].upper() if branch_id else "000"
    return f"{date_part}-{branch_code}-{seq:06d}"


async def generate_internal_sale_number(db: AsyncSession, company_id: str) -> str:
    """Correlativo interno propio de la venta, independiente del numero de
    factura fiscal -- se guarda en numero_interno y se genera SIEMPRE, tenga
    o no la empresa timbrado configurado. Mismo esquema que el legacy
    (campo CD_VENDA de ven_venda, confirmado contra datos reales): un
    entero simple, sin fecha ni sucursal, que sube de a uno por venta de
    toda la empresa -- nunca se reinicia."""
    result = await db.execute(
        select(func.max(cast(Sale.numero_interno, Integer)))
        .where(Sale.company_id == company_id, Sale.numero_interno.isnot(None))
    )
    last = result.scalar_one_or_none()
    return str((last or 0) + 1)


async def resolve_sale_number(db: AsyncSession, data: SaleCreate) -> str:
    """Si la empresa tiene facturacion fiscal configurada (autoimpresor,
    preimpreso o electronico — mismo numerador para los 3), usa el numero
    real 001-XXX-NNNNNNN de su timbrado vigente. Si no tiene nada configurado
    (la mayoria de empresas todavia), sigue con el correlativo interno de
    siempre — no rompe a nadie que no haya migrado a facturacion real."""
    config = await fiscal_service.get_fiscal_config(db, str(data.company_id))
    if not config:
        return await generate_sale_number(db, str(data.company_id), str(data.branch_id) if data.branch_id else None)

    punto_emision = data.punto_emision or config.punto_emision
    return await fiscal_service.reserve_fiscal_invoice_number(db, str(data.company_id), punto_emision, "factura")


async def create_sale(db: AsyncSession, data: SaleCreate) -> Sale:
    numero = await resolve_sale_number(db, data)
    numero_interno = await generate_internal_sale_number(db, str(data.company_id))

    subtotal = Decimal("0")
    descuento_total = Decimal("0")
    base_gravada_10 = Decimal("0")
    base_gravada_5 = Decimal("0")
    base_exenta = Decimal("0")
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")

    sale = Sale(
        id=uuid.uuid4(),
        company_id=data.company_id,
        branch_id=data.branch_id,
        customer_id=data.customer_id,
        emission_point_id=data.emission_point_id,
        numero=numero,
        numero_interno=numero_interno,
        tipo_comprobante=data.tipo_comprobante,
        condicion=data.condicion,
        moneda=data.moneda,
        tipo_cambio=data.tipo_cambio,
        estado="confirmado",
        observaciones=data.observaciones,
        user_id=data.user_id,
        session_id=data.session_id,
        recibo_html=data.recibo_html,
        recibo_escpos_b64=data.recibo_escpos_b64,
    )
    db.add(sale)
    # Ojo: NO se hace flush aca todavia -- subtotal/total (NOT NULL, sin
    # default) recien se calculan despues del loop de items. El id se
    # pre-genera en Python (en vez de esperar el server_default+flush) para
    # que los SaleItem de abajo puedan referenciar sale.id sin forzar un
    # INSERT prematuro de sales con subtotal/total todavia en NULL.

    for item_data in data.items:
        taxes = calculate_taxes(item_data.model_dump())

        item = SaleItem(
            sale_id=sale.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            descripcion=item_data.descripcion,
            cantidad=item_data.cantidad,
            precio_unitario=item_data.precio_unitario,
            descuento_pct=item_data.descuento_pct,
            descuento_monto=taxes["descuento_monto"],
            iva_tasa=item_data.iva_tasa,
            iva_monto=taxes["iva_monto"],
            total=taxes["total"],
            costo_unitario=item_data.costo_unitario,
        )
        db.add(item)

        subtotal += taxes["subtotal_bruto"]
        descuento_total += taxes["descuento_monto"]
        iva_tasa = Decimal(str(item_data.iva_tasa))
        if iva_tasa == Decimal("10"):
            base_gravada_10 += taxes["base"]
            iva_10 += taxes["iva_monto"]
        elif iva_tasa == Decimal("5"):
            base_gravada_5 += taxes["base"]
            iva_5 += taxes["iva_monto"]
        else:
            base_exenta += taxes["base"]

    sale.subtotal = subtotal
    sale.descuento_total = descuento_total
    sale.base_gravada_10 = base_gravada_10
    sale.base_gravada_5 = base_gravada_5
    sale.base_exenta = base_exenta
    sale.iva_10 = iva_10
    sale.iva_5 = iva_5
    sale.total = subtotal - descuento_total
    sale.saldo = sale.total

    # ── Desglose real de medios de pago -- antes este array se armaba en el
    # frontend pero SaleCreate no tenia el campo, asi que Pydantic lo
    # descartaba en silencio: ninguna venta en vivo (a diferencia de las
    # sincronizadas del legado) dejaba un solo SalePayment guardado. Sin
    # esto no hay forma real de saber que medios de pago se usaron en una
    # venta, ni de calcular el efectivo acumulado para la alerta de retiro.
    now = datetime.now(timezone.utc)
    for p in data.payments:
        db.add(SalePayment(
            company_id=data.company_id,
            sale_id=sale.id,
            forma_pago=p.forma_pago,
            monto=p.monto,
            moneda=p.moneda,
            fecha=now,
        ))

    if data.condicion == "credito" and data.customer_id:
        from api.src.credit_accounts.service import get_credit_check, create_approval_request, process_purchase
        from api.src.credit_accounts.models import CreditAccount

        # ── Pago mixto: solo la porcion EXTRA_CLUB va a credito real -- antes
        # esto siempre usaba sale.total entero, asi que una venta mitad
        # efectivo mitad Extra Club le habria descontado el TOTAL de la
        # linea de credito, no solo la parte que realmente se pidio fiado.
        monto_credito = sum(
            (p.monto for p in data.payments if p.forma_pago == "EXTRA_CLUB"), Decimal("0")
        ) or sale.total

        check = await get_credit_check(db, str(data.company_id), str(data.customer_id), monto_credito)

        # ── Excepcion de admin cuando el cliente no tiene linea de credito ──
        # Pedido explicito: sin linea de credito no se puede vender a
        # credito, salvo que un admin lo autorice -- en ese caso se crea una
        # cuenta de credito real, con limite justo para esta compra, en vez
        # de saltarse el control contable. La venta sigue pasando por el
        # mismo camino auditado de siempre (get_credit_check de nuevo).
        if check.get("no_account") and data.admin_override_credito and data.user_id:
            admin_result = await db.execute(select(User).where(User.id == data.user_id))
            admin_user = admin_result.scalar_one_or_none()
            if admin_user and (admin_user.rol == "admin" or admin_user.is_superadmin):
                db.add(CreditAccount(
                    company_id=data.company_id,
                    customer_id=data.customer_id,
                    limite_credito=monto_credito,
                    saldo_utilizado=Decimal("0"),
                    saldo_disponible=monto_credito,
                    activo=True,
                ))
                await db.flush()
                check = await get_credit_check(db, str(data.company_id), str(data.customer_id), monto_credito)

        if check.get("no_account"):
            raise ValueError("Credit account error: No credit account for customer")
        if check.get("inactive"):
            raise ValueError("Credit account error: Credit account inactive")

        if not check["ok"]:
            # Excede el limite disponible: la venta queda retenida, sin
            # descontar stock ni sumar puntos, hasta que Supervisor y
            # Gerente aprueben la excepcion (ver credit_accounts.service).
            sale.estado = "pend_aprob_credito"
            await db.flush()
            await create_approval_request(
                db, data.company_id, sale.id, data.customer_id, check["credit_account_id"],
                monto_credito, check["limite_credito"], check["saldo_disponible"],
            )
            await db.flush()
            await db.refresh(sale)
            return sale

        credit_result = await process_purchase(
            db,
            str(data.company_id),
            str(data.customer_id),
            monto_credito,
            sale.id,
        )
        if "error" in credit_result:
            raise ValueError(f"Credit account error: {credit_result['error']}")
        sale.estado = "confirmado"
        # El resto de la venta (efectivo/tarjeta/qr) ya esta cubierto por lo
        # que llego en data.payments -- pero esos montos pueden venir en
        # BRL/USD sin convertir (el POS solo manda el monto crudo en esa
        # moneda), asi que sumarlos tal cual junto al monto en credito
        # (siempre PYG) daria un total_pagado mal calculado. El frontend ya
        # exige que el pago cubra el total completo antes de habilitar el
        # boton de cobro, asi que la porcion no-credito en PYG es
        # simplemente el resto del total -- no hace falta re-sumar
        # monedas mezcladas aca.
        sale.total_pagado = sale.total
        sale.saldo = Decimal("0")

        from api.src.accounts_receivable.service import create_accounts_receivable_for_sale
        await create_accounts_receivable_for_sale(
            db, str(data.company_id), str(data.customer_id), str(sale.id), monto_credito, sale.numero,
        )

    await _deduct_stock_for_sale(db, sale, data)
    puntos_ganados = await _award_loyalty_points(db, sale, data)

    await db.flush()
    await db.refresh(sale)
    # Atributo transitorio (no es columna) para que el router pueda mostrar
    # los puntos recien ganados en la respuesta -- antes se calculaban pero
    # se perdian, asi que la cajera nunca se enteraba de que se sumaron.
    sale.puntos_ganados = puntos_ganados
    return sale


async def _deduct_stock_for_sale(db: AsyncSession, sale: Sale, data: SaleCreate) -> None:
    for item_data in data.items:
        qty_to_deduct = int(item_data.cantidad)
        warehouse_id = None

        stock_result = await db.execute(
            select(Stock).where(Stock.product_id == item_data.product_id).limit(1)
        )
        stock = stock_result.scalar_one_or_none()
        if stock:
            stock.cantidad -= qty_to_deduct
            stock.updated_at = datetime.now(timezone.utc)
            warehouse_id = stock.warehouse_id

            lots_result = await db.execute(
                select(StockLot)
                .where(
                    StockLot.product_id == item_data.product_id,
                    StockLot.cantidad_disponible > 0,
                )
                .order_by(StockLot.fecha_ingreso.asc())
            )
            lots = list(lots_result.scalars().all())

            remaining = qty_to_deduct
            actual_cost = Decimal("0")
            for lot in lots:
                if remaining <= 0:
                    break
                deduct = min(remaining, int(lot.cantidad_disponible))
                lot.cantidad_disponible -= deduct
                lot.cantidad -= deduct
                actual_cost += Decimal(str(deduct)) * Decimal(str(lot.costo_unitario))

                lot_movement = InventoryMovement(
                    company_id=data.company_id,
                    warehouse_id=warehouse_id,
                    product_id=item_data.product_id,
                    variant_id=item_data.variant_id,
                    tipo="salida_venta_lote",
                    cantidad=-deduct,
                    costo_unitario=lot.costo_unitario,
                    referencia_type="sale",
                    referencia_id=sale.id,
                    user_id=data.user_id,
                )
                db.add(lot_movement)
                remaining -= deduct

            if remaining > 0:
                pass

            avg_cost = (actual_cost / Decimal(str(qty_to_deduct))).quantize(Decimal("1")) if qty_to_deduct > 0 else Decimal("0")

            movement = InventoryMovement(
                company_id=data.company_id,
                warehouse_id=warehouse_id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                tipo="salida_venta",
                cantidad=-qty_to_deduct,
                costo_unitario=avg_cost,
                referencia_type="sale",
                referencia_id=sale.id,
                user_id=data.user_id,
            )
            db.add(movement)


async def _award_loyalty_points(db: AsyncSession, sale: Sale, data: SaleCreate) -> int:
    if not data.customer_id:
        return 0
    from api.src.loyalty import service as loyalty_service
    from api.src.loyalty.schemas import PointsCreate
    config = await loyalty_service.get_or_create_config(db, str(data.company_id))
    if config.activo and config.crear_en_venta and config.puntos_por_guarani > 0:
        # puntos_por_guarani se usa como divisor (guaranies necesarios por punto),
        # no como multiplicador -- con guaranies reales, un multiplicador entero >=1
        # da millones de puntos por venta. Nunca se habia conectado hasta ahora.
        puntos = int(sale.total // config.puntos_por_guarani)
        if puntos > 0:
            await loyalty_service.earn_points(
                db,
                PointsCreate(
                    company_id=data.company_id,
                    customer_id=data.customer_id,
                    tipo="ganado",
                    puntos=puntos,
                    referencia_tipo="sale",
                    referencia_id=str(sale.id),
                    descripcion=f"Compra {sale.numero}",
                ),
                config=config,
            )
            return puntos
    return 0


async def finalize_approved_credit_sale(db: AsyncSession, request) -> Sale:
    """Llamado desde credit_accounts.service.approve_credit_request cuando
    Supervisor Y Gerente ya aprobaron la excepcion de limite. Recien aca se
    descuenta el credito, se confirma la venta, se descuenta stock (diferido
    desde create_sale) y se genera la fila de AR."""
    from api.src.credit_accounts.service import process_purchase
    from api.src.accounts_receivable.service import create_accounts_receivable_for_sale
    from api.src.sales.schemas import SaleCreate

    sale = await get_sale(db, str(request.sale_id))
    if not sale:
        raise ValueError("Venta no encontrada")

    credit_result = await process_purchase(
        db, str(request.company_id), str(request.customer_id), sale.total, sale.id,
        bypass_limit=True,
    )
    if "error" in credit_result:
        raise ValueError(f"Credit account error: {credit_result['error']}")

    sale.estado = "confirmado"
    sale.total_pagado = sale.total
    sale.saldo = Decimal("0")
    await db.flush()

    await create_accounts_receivable_for_sale(
        db, str(sale.company_id), str(sale.customer_id), str(sale.id), sale.total, sale.numero,
    )

    items = await get_sale_items(db, str(sale.id))
    deduct_data = SaleCreate(
        company_id=sale.company_id, branch_id=sale.branch_id, customer_id=sale.customer_id,
        emission_point_id=sale.emission_point_id, tipo_comprobante=sale.tipo_comprobante,
        condicion=sale.condicion, moneda=sale.moneda, tipo_cambio=sale.tipo_cambio,
        user_id=sale.user_id, items=[
            {
                "product_id": i["product_id"], "variant_id": i.get("variant_id"),
                "descripcion": i["descripcion"], "cantidad": i["cantidad"],
                "precio_unitario": i["precio_unitario"], "descuento_pct": i["descuento_pct"],
                "iva_tasa": i["iva_tasa"], "costo_unitario": i.get("costo_unitario") or 0,
            }
            for i in items
        ],
    )
    await _deduct_stock_for_sale(db, sale, deduct_data)
    puntos_ganados = await _award_loyalty_points(db, sale, deduct_data)

    await db.flush()
    await db.refresh(sale)
    sale.puntos_ganados = puntos_ganados
    return sale


async def get_sale(db: AsyncSession, sale_id: str) -> Sale | None:
    result = await db.execute(select(Sale).where(Sale.id == uuid.UUID(sale_id)))
    return result.scalar_one_or_none()


async def attach_escpos_ticket(db: AsyncSession, sale_id: str, recibo_escpos_b64: str) -> bool:
    result = await db.execute(
        update(Sale).where(Sale.id == uuid.UUID(sale_id)).values(recibo_escpos_b64=recibo_escpos_b64)
    )
    await db.commit()
    return result.rowcount > 0


async def reopen_sale_customer(
    db: AsyncSession, sale_id: str, customer_id: str,
    autorizado_por_id: str, autorizado_por_nombre: str,
) -> Sale | None:
    """Agrega la identificacion del cliente a una venta ya cerrada que salio
    como Consumidor Final -- pedido real de las cajeras: el cliente se va,
    la venta ya se cerro, y despues vuelve pidiendo que la factura lleve su
    nombre. No reabre el cobro ni toca montos/items, solo el vinculo al
    cliente -- siempre requiere autorizacion de supervisor (verificada en el
    frontend via el mismo flujo de solicitud remota que ya usan devoluciones
    y pagos Extra Club antes de llegar aca)."""
    result = await db.execute(select(Sale).where(Sale.id == uuid.UUID(sale_id)))
    sale = result.scalar_one_or_none()
    if not sale:
        return None
    sale.customer_id = uuid.UUID(customer_id)
    nota = f"[{datetime.now(timezone.utc).isoformat()}] Identificacion agregada por {autorizado_por_nombre}"
    sale.observaciones = f"{sale.observaciones}\n{nota}" if sale.observaciones else nota
    await db.commit()
    await db.refresh(sale)
    return sale


async def list_sales(
    db: AsyncSession,
    company_id: str,
    customer_id: str | None = None,
    estado: str | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Sale]:
    query = select(Sale).where(Sale.company_id == company_id)
    if customer_id:
        query = query.where(Sale.customer_id == customer_id)
    if estado:
        query = query.where(Sale.estado == estado)
    if fecha_desde:
        query = query.where(Sale.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.where(Sale.fecha <= fecha_hasta)
    if user_id:
        query = query.where(Sale.user_id == user_id)
    if session_id:
        query = query.where(Sale.session_id == session_id)
    query = query.order_by(Sale.fecha.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_sales_today(db: AsyncSession, company_id: str) -> dict:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(Sale).where(
            Sale.company_id == company_id,
            Sale.fecha >= today_start,
            Sale.estado == "confirmado",
        )
    )
    sales = result.scalars().all()
    total_ventas = sum(int(s.total) for s in sales)
    total_iva = sum(int(s.iva_10) + int(s.iva_5) for s in sales)
    return {
        "cantidad": len(sales),
        "total_ventas": total_ventas,
        "total_iva": total_iva,
        "base_gravada_10": sum(int(s.base_gravada_10) for s in sales),
        "base_gravada_5": sum(int(s.base_gravada_5) for s in sales),
    }


async def cancel_sale(db: AsyncSession, sale_id: str) -> Sale | None:
    sale = await get_sale(db, sale_id)
    if not sale:
        return None
    if sale.estado in ("cancelado", "devuelto"):
        return None

    sale.estado = "cancelado"
    sale.updated_at = datetime.now(timezone.utc)
    # Antes solo se restauraba stock -- la cuenta por cobrar quedaba
    # "pendiente" para siempre (podia bloquear credito futuro por mora de
    # una venta que ya no existe), el credito reservado nunca se liberaba
    # (el limite del cliente se iba comiendo con cada cancelacion aunque no
    # deba nada), los puntos de fidelidad ganados quedaban en su saldo, y
    # total_pagado/saldo se quedaban con el valor de una venta que ya no
    # esta vigente.
    sale.total_pagado = Decimal("0")
    sale.saldo = Decimal("0")

    if sale.condicion == "credito" and sale.customer_id:
        from api.src.credit_accounts.models import CreditAccount, CreditMovement
        compra_result = await db.execute(
            select(CreditMovement)
            .where(
                CreditMovement.referencia_type == "sale",
                CreditMovement.referencia_id == sale.id,
                CreditMovement.tipo == "compra",
            )
            .order_by(CreditMovement.created_at.desc())
            .limit(1)
        )
        compra_mov = compra_result.scalar_one_or_none()
        if compra_mov:
            account_result = await db.execute(select(CreditAccount).where(CreditAccount.id == compra_mov.credit_account_id))
            account = account_result.scalar_one_or_none()
            if account:
                monto = compra_mov.monto
                saldo_anterior = account.saldo_utilizado
                account.saldo_utilizado = max(Decimal("0"), account.saldo_utilizado - monto)
                account.saldo_disponible += monto
                db.add(CreditMovement(
                    company_id=account.company_id,
                    credit_account_id=account.id,
                    customer_id=account.customer_id,
                    tipo="devolucion",
                    monto=monto,
                    saldo_anterior=saldo_anterior,
                    saldo_nuevo=account.saldo_utilizado,
                    referencia_type="sale",
                    referencia_id=sale.id,
                    observaciones=f"Venta {sale.numero} cancelada -- libera credito reservado",
                ))

        await db.execute(
            text("""
                UPDATE accounts_receivable
                SET estado = 'cancelado', saldo_pendiente = 0
                WHERE sale_id = :sale_id AND estado = 'pendiente'
            """),
            {"sale_id": str(sale.id)},
        )

    from api.src.loyalty.models import LoyaltyPoints
    puntos_result = await db.execute(
        select(func.coalesce(func.sum(LoyaltyPoints.puntos), 0))
        .where(LoyaltyPoints.referencia_tipo == "sale", LoyaltyPoints.referencia_id == str(sale.id), LoyaltyPoints.tipo == "ganado")
    )
    puntos_otorgados = puntos_result.scalar() or 0
    if puntos_otorgados and sale.customer_id:
        db.add(LoyaltyPoints(
            company_id=sale.company_id,
            customer_id=sale.customer_id,
            tipo="ajustado",
            puntos=-int(puntos_otorgados),
            referencia_tipo="sale",
            referencia_id=str(sale.id),
            descripcion=f"Reverso por cancelacion de venta {sale.numero}",
        ))

    items_result = await db.execute(select(SaleItem).where(SaleItem.sale_id == sale.id))
    for item in items_result.scalars().all():
        stock_result = await db.execute(select(Stock).where(Stock.product_id == item.product_id).limit(1))
        stock = stock_result.scalar_one_or_none()
        if stock:
            qty = int(item.cantidad)
            stock.cantidad += qty
            stock.updated_at = datetime.now(timezone.utc)

            lots_result = await db.execute(
                select(StockLot)
                .where(
                    StockLot.product_id == item.product_id,
                    StockLot.warehouse_id == stock.warehouse_id,
                )
                .order_by(StockLot.fecha_ingreso.desc())
            )
            lots = list(lots_result.scalars().all())

            remaining = qty
            for lot in lots:
                if remaining <= 0:
                    break
                lot.cantidad_disponible += remaining
                lot.cantidad += remaining
                remaining = 0

            db.add(InventoryMovement(
                company_id=sale.company_id,
                product_id=item.product_id,
                warehouse_id=stock.warehouse_id,
                tipo="entrada_cancelacion_venta",
                cantidad=qty,
                referencia_type="sale",
                referencia_id=sale.id,
                motivo=f"Cancelacion de venta {sale.numero}",
            ))

    await db.flush()
    await db.refresh(sale)
    return sale


async def get_sale_items(db: AsyncSession, sale_id: str) -> list[dict]:
    from api.src.returns.models import Return, ReturnItem

    result = await db.execute(select(SaleItem).where(SaleItem.sale_id == uuid.UUID(sale_id)))
    items = result.scalars().all()

    # Cuanto de cada item ya tiene una devolucion pendiente o aprobada --
    # sin esto la pantalla de devolucion en caja no tiene forma de saber
    # que parte de un item ya fue devuelta antes, y deja devolver de nuevo
    # lo mismo.
    devueltos_result = await db.execute(
        select(ReturnItem.sale_item_id, func.coalesce(func.sum(ReturnItem.cantidad), 0))
        .join(Return, Return.id == ReturnItem.return_id)
        .where(Return.sale_id == uuid.UUID(sale_id), Return.estado.in_(["pendiente", "aprobado"]))
        .group_by(ReturnItem.sale_item_id)
    )
    devueltos = {str(sid): float(qty) for sid, qty in devueltos_result.all() if sid is not None}

    return [
        {
            "id": str(i.id),
            "sale_id": str(i.sale_id),
            "product_id": str(i.product_id),
            "descripcion": i.descripcion,
            "cantidad": float(i.cantidad),
            "cantidad_devuelta": devueltos.get(str(i.id), 0.0),
            "cantidad_disponible": max(0.0, float(i.cantidad) - devueltos.get(str(i.id), 0.0)),
            "precio_unitario": int(i.precio_unitario),
            "descuento_pct": float(i.descuento_pct),
            "descuento_monto": int(i.descuento_monto),
            "iva_tasa": float(i.iva_tasa),
            "iva_monto": int(i.iva_monto),
            "total": int(i.total),
            "costo_unitario": int(i.costo_unitario) if i.costo_unitario else None,
            "created_at": i.created_at,
        }
        for i in items
    ]


async def update_sale(db: AsyncSession, sale_id: str, data: SaleUpdate) -> Sale | None:
    sale = await get_sale(db, sale_id)
    if not sale or sale.estado in ("cancelado", "devuelto", "completado"):
        return None

    if data.customer_id is not None:
        sale.customer_id = data.customer_id
    if data.observaciones is not None:
        sale.observaciones = data.observaciones
    if data.items is not None:
        existing = await db.execute(select(SaleItem).where(SaleItem.sale_id == sale.id))
        for item in existing.scalars().all():
            await db.delete(item)

        subtotal = descuento_total = base_gravada_10 = base_gravada_5 = base_exenta = iva_10 = iva_5 = Decimal("0")
        for item_data in data.items:
            taxes = calculate_taxes(item_data.model_dump())
            item = SaleItem(
                sale_id=sale.id, product_id=item_data.product_id, variant_id=item_data.variant_id,
                descripcion=item_data.descripcion, cantidad=item_data.cantidad,
                precio_unitario=item_data.precio_unitario, descuento_pct=item_data.descuento_pct,
                descuento_monto=taxes["descuento_monto"], iva_tasa=item_data.iva_tasa,
                iva_monto=taxes["iva_monto"], total=taxes["total"],
            )
            db.add(item)
            subtotal += taxes["subtotal_bruto"]; descuento_total += taxes["descuento_monto"]
            tasa = Decimal(str(item_data.iva_tasa))
            if tasa == Decimal("10"):
                base_gravada_10 += taxes["base"]; iva_10 += taxes["iva_monto"]
            elif tasa == Decimal("5"):
                base_gravada_5 += taxes["base"]; iva_5 += taxes["iva_monto"]
            else:
                base_exenta += taxes["base"]

        sale.subtotal = subtotal; sale.descuento_total = descuento_total
        sale.base_gravada_10 = base_gravada_10; sale.base_gravada_5 = base_gravada_5
        sale.base_exenta = base_exenta; sale.iva_10 = iva_10; sale.iva_5 = iva_5
        sale.total = subtotal - descuento_total
        sale.saldo = sale.total - (sale.total_pagado or 0)

    sale.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(sale)
    return sale


async def add_payment(db: AsyncSession, sale_id: str, data: SaleAddPayment) -> dict:
    sale = await get_sale(db, sale_id)
    if not sale:
        return {"error": "Venta no encontrada"}
    if sale.estado in ("cancelado", "devuelto"):
        return {"error": "Venta cancelada o devuelta"}

    from api.src.payments.models import Payment
    from api.src.payments.schemas import PaymentCreate

    payment = Payment(
        company_id=sale.company_id,
        tipo="cobro",
        payment_method_id=data.payment_method_id,
        moneda=sale.moneda,
        tipo_cambio=sale.tipo_cambio,
        monto=data.monto,
        monto_pyg=data.monto if sale.moneda == "PYG" else data.monto * sale.tipo_cambio,
        referencia=data.referencia,
        estado="confirmado",
        user_id=data.user_id,
    )
    db.add(payment)
    await db.flush()

    await db.execute(
        text("""
            INSERT INTO payment_allocations (payment_id, sale_id, monto_asignado)
            VALUES (:payment_id, :sale_id, :monto)
        """),
        {"payment_id": payment.id, "sale_id": sale.id, "monto": float(data.monto)},
    )

    sale.total_pagado = (sale.total_pagado or 0) + data.monto
    sale.saldo = sale.total - sale.total_pagado

    if sale.saldo <= 0:
        sale.estado = "pagado"
        sale.saldo = Decimal("0")

    if sale.condicion == "credito" and sale.saldo > 0:
        sale.estado = "parcial"

    sale.updated_at = datetime.now(timezone.utc)

    from api.src.accounts_receivable.service import apply_payment_to_receivable
    await apply_payment_to_receivable(db, str(sale.company_id), str(sale.id), data.monto)

    await db.flush()
    await db.refresh(sale)
    return {"sale": sale, "payment": payment}


async def link_quote(db: AsyncSession, sale_id: str, quote_id: str) -> bool:
    sale = await get_sale(db, sale_id)
    if not sale:
        return False
    from api.src.quotes.service import change_quote_status
    result = await change_quote_status(db, quote_id, "convertida", sale_id)
    return result is not None


async def link_order(db: AsyncSession, sale_id: str, order_id: str) -> bool:
    sale = await get_sale(db, sale_id)
    if not sale:
        return False
    from api.src.sales_orders.service import change_order_status
    result = await change_order_status(db, order_id, "facturado")
    return result is not None
