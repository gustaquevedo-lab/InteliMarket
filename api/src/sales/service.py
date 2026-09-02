"""Sales service"""

from sqlalchemy import select, update, func, cast, Integer, text, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from api.src.sales.models import Sale, SaleItem, SalePayment
from api.src.auth.models import User
from api.src.caja.models import CashSession, CashRegister
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

    # ── PROTECCIÓN ANTI-HUÉRFANAS: RESOLUCIÓN INTELIGENTE DE SESIÓN ──────
    effective_session_id = data.session_id
    if effective_session_id:
        sess_check = await db.execute(
            select(CashSession.id, CashSession.estado)
            .where(CashSession.id == effective_session_id)
        )
        sess_row = sess_check.first()
        if not sess_row or sess_row[1] == "cerrada":
            # La sesión enviada por el frontend no existe o ya fue cerrada previamente
            effective_session_id = None

    if not effective_session_id and data.user_id:
        active_user_sess = await db.execute(
            select(CashSession.id)
            .where(CashSession.user_id == data.user_id, CashSession.estado == "abierta")
            .order_by(CashSession.fecha_apertura.desc())
            .limit(1)
        )
        found_sess = active_user_sess.scalar_one_or_none()
        if found_sess:
            effective_session_id = found_sess
        else:
            # Auto-abrir sesión para que ninguna venta quede huérfana,
            # buscando la caja que coincide con el punto de emisión del ticket (ej: 015 -> Caja 5)
            punto_emision_code = None
            if numero and "-" in numero:
                parts = numero.split("-")
                if len(parts) >= 2:
                    punto_emision_code = parts[1]  # ej: "015"

            reg_id = None
            if punto_emision_code:
                clean_num = punto_emision_code.lstrip("0")
                reg_res = await db.execute(
                    select(CashRegister.id)
                    .where(
                        CashRegister.activo == True,
                        or_(
                            CashRegister.codigo.ilike(f"%{punto_emision_code}%"),
                            CashRegister.nombre.ilike(f"%Caja {clean_num}%") if clean_num else False,
                        )
                    )
                    .limit(1)
                )
                reg_id = reg_res.scalar_one_or_none()

            if not reg_id:
                # Fallback: primera caja activa de producción (nunca inactivas ni Caja 2 de sandbox)
                reg_res = await db.execute(
                    select(CashRegister.id)
                    .where(CashRegister.activo == True, CashRegister.codigo != "POS-012")
                    .order_by(CashRegister.nombre.asc())
                    .limit(1)
                )
                reg_id = reg_res.scalar_one_or_none()

            if reg_id:
                u_res = await db.execute(select(User.nombre).where(User.id == data.user_id))
                u_nombre = u_res.scalar_one_or_none() or "Cajero"
                auto_sess = CashSession(
                    register_id=reg_id,
                    user_id=data.user_id,
                    cajero_nombre=u_nombre,
                    monto_apertura=Decimal("0"),
                    monto_apertura_usd=Decimal("0"),
                    monto_apertura_brl=Decimal("0"),
                    estado="abierta",
                    observaciones=f"Apertura automática de emergencia al emitir comprobante {numero} sin sesión previa.",
                )
                db.add(auto_sess)
                await db.flush()
                effective_session_id = auto_sess.id

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
        session_id=effective_session_id,
        recibo_html=data.recibo_html,
        recibo_escpos_b64=data.recibo_escpos_b64,
        monto_donacion=data.monto_donacion or Decimal("0"),
        donacion_campana=data.donacion_campana,
        donacion_ong=data.donacion_ong,
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

    # ── Registro de Micro-Donación / Redondeo Solidario (Amor y Esperanza) ──
    if data.monto_donacion and data.monto_donacion > Decimal("0"):
        from api.src.donaciones.models import DonationRecord
        from api.src.donaciones.service import get_or_create_default_campaign
        try:
            camp = await get_or_create_default_campaign(db, str(data.company_id))
            user_name = None
            if data.user_id:
                u_res = await db.execute(select(User.nombre).where(User.id == data.user_id))
                user_name = u_res.scalar_one_or_none()

            db.add(DonationRecord(
                company_id=data.company_id,
                branch_id=data.branch_id,
                sale_id=sale.id,
                session_id=data.session_id,
                user_id=data.user_id,
                cajero_nombre=user_name or "Cajero",
                campana_id=camp.id,
                monto_pyg=data.monto_donacion,
                monto_total_venta_pyg=sale.total,
                numero_comprobante=sale.numero,
                tipo_origen="redondeo_vuelto",
                estado="recaudado",
            ))
        except Exception as don_err:
            # Fallback seguro: no bloquear la venta si falla el log de donación
            print(f"[DONACIONES] Advertencia registrando donacion: {don_err}")

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
    from api.src.customers.models import Customer
    result = await db.execute(
        select(Sale, Customer, SalePayment)
        .outerjoin(Customer, Customer.id == Sale.customer_id)
        .outerjoin(SalePayment, SalePayment.sale_id == Sale.id)
        .where(Sale.id == uuid.UUID(sale_id))
    )
    row = result.first()
    if not row:
        return None
    sale, cust, payment = row
    fp = payment.forma_pago if payment else ("EXTRA_CLUB" if sale.condicion == "credito" else "EFECTIVO")
    c_name = cust.razon_social or cust.nombre_fantasia if cust else "Consumidor Final"
    c_doc = cust.ruc or cust.ci or cust.telefono if cust else None
    c_ec = cust.extra_club_numero if cust else None
    setattr(sale, "forma_pago", fp)
    setattr(sale, "customer_nombre", c_name)
    setattr(sale, "customer_doc", c_doc)
    setattr(sale, "customer_extra_club", c_ec)
    return sale


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


async def reopen_sale_payment(
    db: AsyncSession,
    sale_id: str,
    nueva_forma_pago: str,
    motivo: str,
    autorizado_por_id: str,
    autorizado_por_nombre: str,
    customer_id: str | None = None,
) -> Sale | None:
    """Cambia la forma de pago de una venta ya cerrada y opcionalmente vincula al socio cliente.

    Esta es una operación de alto riesgo contable:
    - Solo debe ejecutarse en ventas del turno activo (validado en frontend).
    - Requiere autorización de supervisor y motivo descriptivo.
    - Deja trazabilidad completa en `observaciones` (no borra el dato anterior).
    - Actualiza `customer_id` (si se provee), `condicion` y los registros en `sale_payments`.
    """
    from .schemas import FORMAS_PAGO_VALIDAS
    if nueva_forma_pago.upper() not in FORMAS_PAGO_VALIDAS:
        raise ValueError(f"Forma de pago inválida: {nueva_forma_pago}. Valores permitidos: {FORMAS_PAGO_VALIDAS}")

    result = await db.execute(select(Sale).where(Sale.id == uuid.UUID(sale_id)))
    sale = result.scalar_one_or_none()
    if not sale:
        return None

    # Obtener forma de pago anterior desde sale_payments
    pm_res = await db.execute(select(SalePayment).where(SalePayment.sale_id == sale.id))
    existing_payments = list(pm_res.scalars().all())
    forma_pago_anterior = existing_payments[0].forma_pago if existing_payments else (
        "EXTRA_CLUB" if sale.condicion == "credito" else "EFECTIVO"
    )

    socio_nombre = ""
    if customer_id:
        sale.customer_id = uuid.UUID(customer_id)
        from api.src.customers.models import Customer
        cust_res = await db.execute(select(Customer).where(Customer.id == uuid.UUID(customer_id)))
        cust_obj = cust_res.scalar_one_or_none()
        if cust_obj:
            socio_nombre = cust_obj.razon_social or cust_obj.nombre_fantasia or ""

    if nueva_forma_pago.upper() in ("EXTRA_CLUB", "CREDITO"):
        sale.condicion = "credito"
    elif nueva_forma_pago.upper() in ("EFECTIVO", "TARJETA", "TRANSFERENCIA", "QR"):
        sale.condicion = "contado"

    # Actualizar o insertar en sale_payments
    if existing_payments:
        await db.execute(
            update(SalePayment)
            .where(SalePayment.sale_id == sale.id)
            .values(forma_pago=nueva_forma_pago.upper())
        )
    else:
        db.add(SalePayment(
            company_id=sale.company_id,
            sale_id=sale.id,
            forma_pago=nueva_forma_pago.upper(),
            monto=sale.total,
            moneda=sale.moneda or "PYG",
            fecha=sale.fecha or datetime.now(timezone.utc),
        ))

    ts = datetime.now(timezone.utc).isoformat()
    socio_txt = f" | Socio: {socio_nombre} (ID: {customer_id})" if customer_id else ""
    nota_auditoria = (
        f"[{ts}] ⚠️ CAMBIO DE FORMA DE PAGO — Autorizado por: {autorizado_por_nombre} "
        f"(ID: {autorizado_por_id}) | "
        f"Anterior: {forma_pago_anterior} → Nueva: {nueva_forma_pago.upper()}{socio_txt} | "
        f"Motivo: {motivo.strip()}"
    )
    sale.observaciones = (
        f"{sale.observaciones}\n{nota_auditoria}"
        if sale.observaciones
        else nota_auditoria
    )
    await db.commit()
    await db.refresh(sale)
    setattr(sale, "forma_pago", nueva_forma_pago.upper())
    if socio_nombre:
        setattr(sale, "customer_nombre", socio_nombre)
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
    from api.src.customers.models import Customer
    query = (
        select(Sale, Customer, SalePayment)
        .outerjoin(Customer, Customer.id == Sale.customer_id)
        .outerjoin(SalePayment, SalePayment.sale_id == Sale.id)
        .where(Sale.company_id == company_id)
    )
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
    query = query.order_by(Sale.fecha.desc()).limit(limit * 2).offset(offset)
    result = await db.execute(query)
    rows = result.all()
    sales_dict = {}
    for sale, cust, payment in rows:
        if sale.id not in sales_dict:
            fp = payment.forma_pago if payment else (
                "EXTRA_CLUB" if sale.condicion == "credito" else "EFECTIVO"
            )
            c_name = cust.razon_social or cust.nombre_fantasia if cust else "Consumidor Final"
            c_doc = cust.ruc or cust.ci or cust.telefono if cust else None
            c_ec = cust.extra_club_numero if cust else None
            setattr(sale, "forma_pago", fp)
            setattr(sale, "customer_nombre", c_name)
            setattr(sale, "customer_doc", c_doc)
            setattr(sale, "customer_extra_club", c_ec)
            sales_dict[sale.id] = sale
            if len(sales_dict) >= limit:
                break
    return list(sales_dict.values())


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
