"""Credit account service"""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timezone, date
from decimal import Decimal, ROUND_HALF_UP
import json
import uuid

from api.src.credit_accounts.models import CreditAccount, CreditMovement, CreditApprovalRequest, ReceivableWriteoffRequest, CustomerAdvance
from api.src.credit_accounts.schemas import CreditAccountCreate, CreditAccountUpdate, CreditPayment, MoraConfig, DunningConfig, CustomerAdvanceCreate
from api.src.customers.models import Customer


async def _sync_credito_usado(db: AsyncSession, company_id, customer_id, saldo_utilizado: Decimal) -> None:
    result = await db.execute(
        select(Customer).where(Customer.company_id == company_id, Customer.id == uuid.UUID(str(customer_id)))
    )
    customer = result.scalar_one_or_none()
    if customer:
        customer.credito_usado = saldo_utilizado


async def create_credit_account(db: AsyncSession, data: CreditAccountCreate) -> CreditAccount:
    account = CreditAccount(
        company_id=data.company_id,
        customer_id=data.customer_id,
        limite_credito=data.limite_credito,
        saldo_disponible=data.limite_credito,
        saldo_utilizado=0,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def list_credit_accounts(db: AsyncSession, company_id: str, activo: Optional[bool] = None) -> list[CreditAccount]:
    query = select(CreditAccount, Customer.razon_social, Customer.ruc).join(
        Customer, Customer.id == CreditAccount.customer_id, isouter=True
    ).where(CreditAccount.company_id == company_id)
    if activo is not None:
        query = query.where(CreditAccount.activo == activo)
    query = query.order_by(CreditAccount.saldo_utilizado.desc())
    result = await db.execute(query)
    accounts = []
    for account, razon_social, ruc in result.all():
        account.customer_nombre = razon_social
        account.customer_ruc = ruc
        accounts.append(account)

    if accounts:
        # dias_mora (columna guardada) no se mantiene actualizada -- da 0 para
        # las 748 facturas pendientes reales de esta empresa, aunque 74 de
        # ellas ya vencieron por fecha_vencimiento. Se calcula en vivo desde
        # fecha_vencimiento, mismo patron que ya usa el aging de AP.
        mora_result = await db.execute(
            text("""
                SELECT customer_id, COALESCE(MAX(GREATEST(0, CURRENT_DATE - fecha_vencimiento)), 0) as max_mora
                FROM accounts_receivable
                WHERE company_id = :cid AND estado = 'pendiente'
                GROUP BY customer_id
            """),
            {"cid": company_id},
        )
        mora_map = {str(r.customer_id): r.max_mora for r in mora_result.fetchall()}
        for account in accounts:
            account.dias_mora_max = mora_map.get(str(account.customer_id), 0)
            account.en_mora = account.dias_mora_max > MORA_BLOQUEO_DIAS

    return accounts


async def get_credit_account(db: AsyncSession, account_id: str) -> CreditAccount | None:
    result = await db.execute(select(CreditAccount).where(CreditAccount.id == uuid.UUID(account_id)))
    return result.scalar_one_or_none()


async def get_credit_account_by_customer(db: AsyncSession, company_id: str, customer_id: str) -> CreditAccount | None:
    result = await db.execute(
        select(CreditAccount).where(
            CreditAccount.company_id == company_id,
            CreditAccount.customer_id == uuid.UUID(customer_id),
        )
    )
    return result.scalar_one_or_none()


async def update_credit_account(db: AsyncSession, account_id: str, data: CreditAccountUpdate) -> CreditAccount | None:
    account = await get_credit_account(db, account_id)
    if not account:
        return None
    update_data = data.model_dump(exclude_unset=True)
    nuevo_limite = None
    if "limite_credito" in update_data:
        nuevo_limite = Decimal(str(update_data["limite_credito"]))
        diferencia = nuevo_limite - Decimal(str(account.limite_credito))
        account.saldo_disponible = Decimal(str(account.saldo_disponible)) + diferencia
        account.limite_credito = nuevo_limite
    if "activo" in update_data:
        account.activo = update_data["activo"]

    # Sincronizar tabla customers para mantener coherencia total
    if account.customer_id:
        from api.src.customers.models import Customer
        cust_res = await db.execute(select(Customer).where(Customer.id == account.customer_id))
        cust = cust_res.scalar_one_or_none()
        if cust:
            if nuevo_limite is not None:
                cust.limite_credito = nuevo_limite
                cust.credito_limite = nuevo_limite
            if "activo" in update_data:
                cust.activo = update_data["activo"]

    await db.commit()
    await db.refresh(account)
    return account



MORA_BLOQUEO_DIAS = 60  # facturas vencidas hace mas de esto retienen nuevas ventas a credito, aunque haya limite disponible


async def get_credit_check(db: AsyncSession, company_id: str, customer_id: str, monto: Decimal) -> dict:
    """Validacion de solo lectura, sin efectos secundarios — usada por
    create_sale para decidir si una venta a credito se confirma directo o
    queda retenida pendiente de aprobacion (Supervisor+Gerente).

    Ademas del limite numerico, bloquea si el cliente tiene facturas vencidas
    hace mas de MORA_BLOQUEO_DIAS -- un cliente con saldo disponible pero en
    mora seria no deberia poder seguir comprando a credito sin que alguien lo
    revise, es el mismo hueco que el chequeo de solo-limite dejaba abierto."""
    account = await get_credit_account_by_customer(db, company_id, customer_id)
    if not account:
        return {"ok": False, "no_account": True}
    if not account.activo:
        return {"ok": False, "inactive": True}

    mora_result = await db.execute(
        text("""
            SELECT COALESCE(MAX(GREATEST(0, CURRENT_DATE - fecha_vencimiento)), 0) FROM accounts_receivable
            WHERE company_id = :cid AND customer_id = :custid AND estado = 'pendiente'
        """),
        {"cid": company_id, "custid": customer_id},
    )
    max_dias_mora = int(mora_result.scalar() or 0)

    disponible = Decimal(str(account.saldo_disponible))
    en_mora = max_dias_mora > MORA_BLOQUEO_DIAS
    return {
        "ok": disponible >= monto and not en_mora,
        "credit_account_id": account.id,
        "limite_credito": account.limite_credito,
        "saldo_disponible": account.saldo_disponible,
        "en_mora": en_mora,
        "dias_mora": max_dias_mora,
    }


async def process_purchase(
    db: AsyncSession, company_id: str, customer_id: str, monto: Decimal, sale_id: uuid.UUID,
    bypass_limit: bool = False,
) -> dict:
    """bypass_limit=True se usa solo desde finalize_approved_credit_sale: la
    venta ya paso por la excepcion de Supervisor+Gerente, asi que el chequeo
    de limite (que ya se hizo antes, para generar la aprobacion) no debe
    volver a rechazarla — el saldo_disponible puede quedar en negativo, que
    es justamente lo que la aprobacion autorizo."""
    # SELECT ... FOR UPDATE -- sin esto, dos ventas a credito casi
    # simultaneas del mismo cliente pueden leer el mismo saldo_disponible
    # antes de que ninguna confirme, y la que commitea despues pisa
    # silenciosamente el descuento de la otra (mismo patron de carrera ya
    # corregido en caja.confirm_cash_drop_request). El bloqueo mantiene la
    # fila tomada hasta el commit de esta transaccion, asi la segunda venta
    # concurrente espera y vuelve a leer el saldo ya actualizado.
    result = await db.execute(
        select(CreditAccount).where(
            CreditAccount.company_id == company_id,
            CreditAccount.customer_id == uuid.UUID(customer_id),
        ).with_for_update()
    )
    account = result.scalar_one_or_none()
    if not account:
        return {"error": "No credit account for customer"}
    if not account.activo:
        return {"error": "Credit account inactive"}
    if not bypass_limit and Decimal(str(account.saldo_disponible)) < monto:
        return {"error": "Insufficient credit", "disponible": float(account.saldo_disponible), "monto": float(monto)}

    saldo_anterior = Decimal(str(account.saldo_utilizado))
    account.saldo_utilizado += monto
    account.saldo_disponible -= monto

    movement = CreditMovement(
        company_id=company_id,
        credit_account_id=account.id,
        customer_id=uuid.UUID(customer_id),
        tipo="compra",
        monto=monto,
        saldo_anterior=saldo_anterior,
        saldo_nuevo=account.saldo_utilizado,
        referencia_type="sale",
        referencia_id=sale_id,
    )
    db.add(movement)
    await _sync_credito_usado(db, company_id, customer_id, account.saldo_utilizado)
    await db.flush()
    await db.refresh(account)
    return {"success": True, "account": account}


async def create_approval_request(
    db: AsyncSession, company_id, sale_id, customer_id, credit_account_id,
    monto: Decimal, limite_credito: Decimal, saldo_disponible: Decimal,
) -> CreditApprovalRequest:
    request = CreditApprovalRequest(
        company_id=company_id,
        sale_id=sale_id,
        customer_id=customer_id,
        credit_account_id=credit_account_id,
        monto=monto,
        limite_credito=limite_credito,
        saldo_disponible=saldo_disponible,
    )
    db.add(request)
    await db.flush()
    await db.refresh(request)
    return request


async def list_approval_requests(db: AsyncSession, company_id: str, estado: str | None = "pendiente") -> list[dict]:
    query = select(CreditApprovalRequest, Customer.razon_social).join(
        Customer, Customer.id == CreditApprovalRequest.customer_id, isouter=True
    ).where(CreditApprovalRequest.company_id == company_id)
    if estado:
        query = query.where(CreditApprovalRequest.estado == estado)
    query = query.order_by(CreditApprovalRequest.created_at.desc())
    result = await db.execute(query)
    requests = []
    for req, razon_social in result.all():
        req.customer_nombre = razon_social
        requests.append(req)
    return requests


async def get_approval_request(db: AsyncSession, request_id: str) -> CreditApprovalRequest | None:
    result = await db.execute(select(CreditApprovalRequest).where(CreditApprovalRequest.id == uuid.UUID(request_id)))
    return result.scalar_one_or_none()


async def approve_credit_request(db: AsyncSession, request_id: str, user_id: str, tenant_id: str) -> dict:
    from api.src.rbac.service import get_user_roles

    request = await get_approval_request(db, request_id)
    if not request:
        return {"error": "Solicitud no encontrada"}
    if request.estado != "pendiente":
        return {"error": f"La solicitud ya está en estado '{request.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    # Un solo llamado llena UN solo slot, incluso si la persona tiene ambos
    # roles -- si no, alguien con Supervisor+Gerente podria auto-aprobar los
    # dos niveles en una sola accion, rompiendo el control de doble aprobacion.
    filled_now = None
    if "Supervisor" in roles and not request.aprobado_supervisor_id:
        request.aprobado_supervisor_id = uuid.UUID(user_id)
        request.aprobado_supervisor_at = datetime.now(timezone.utc)
        filled_now = "supervisor"
    elif "Gerente" in roles and not request.aprobado_gerente_id:
        request.aprobado_gerente_id = uuid.UUID(user_id)
        request.aprobado_gerente_at = datetime.now(timezone.utc)
        filled_now = "gerente"

    if not filled_now:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente (o ya aprobaste esta solicitud)"}

    await db.flush()

    if request.aprobado_supervisor_id and request.aprobado_gerente_id:
        request.estado = "aprobado"

        from api.src.sales.service import finalize_approved_credit_sale
        await finalize_approved_credit_sale(db, request)

        await db.flush()

    await db.refresh(request)
    return {"success": True, "request": request, "completo": request.estado == "aprobado"}


async def reject_credit_request(db: AsyncSession, request_id: str, user_id: str, tenant_id: str, motivo: str) -> dict:
    from api.src.rbac.service import get_user_roles
    from api.src.sales.models import Sale

    request = await get_approval_request(db, request_id)
    if not request:
        return {"error": "Solicitud no encontrada"}
    if request.estado != "pendiente":
        return {"error": f"La solicitud ya está en estado '{request.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    if "Supervisor" not in roles and "Gerente" not in roles:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente"}

    request.estado = "rechazado"
    request.rechazado_por = uuid.UUID(user_id)
    request.rechazado_at = datetime.now(timezone.utc)
    request.rechazado_motivo = motivo

    sale_result = await db.execute(select(Sale).where(Sale.id == request.sale_id))
    sale = sale_result.scalar_one_or_none()
    if sale:
        sale.estado = "cancelado"

    await db.flush()
    await db.refresh(request)
    return {"success": True, "request": request}


async def process_payment(db: AsyncSession, company_id: str, customer_id: str, data: CreditPayment) -> dict:
    account = await get_credit_account_by_customer(db, company_id, customer_id)
    if not account:
        return {"error": "No credit account for customer"}

    monto = Decimal(str(data.monto))
    saldo_anterior = Decimal(str(account.saldo_utilizado))
    pago_aplicado = min(monto, saldo_anterior)

    account.saldo_utilizado -= pago_aplicado
    account.saldo_disponible += pago_aplicado

    movement = CreditMovement(
        company_id=company_id,
        credit_account_id=account.id,
        customer_id=uuid.UUID(customer_id),
        tipo="pago",
        monto=pago_aplicado,
        saldo_anterior=saldo_anterior,
        saldo_nuevo=account.saldo_utilizado,
        referencia_type="payment",
        observaciones=data.observaciones,
    )
    db.add(movement)
    await _sync_credito_usado(db, company_id, customer_id, account.saldo_utilizado)

    docs_result = await db.execute(
        text("""
            SELECT id, saldo_pendiente FROM accounts_receivable
            WHERE company_id = :company_id AND customer_id = :customer_id AND estado = 'pendiente'
            ORDER BY fecha_vencimiento ASC
        """),
        {"company_id": str(company_id), "customer_id": str(customer_id)},
    )
    restante = pago_aplicado
    for doc in docs_result.fetchall():
        if restante <= 0:
            break
        saldo_doc = Decimal(str(doc.saldo_pendiente))
        aplicado_doc = min(restante, saldo_doc)
        nuevo_saldo_doc = saldo_doc - aplicado_doc
        nuevo_estado_doc = "pagado" if nuevo_saldo_doc <= 0 else "pendiente"
        await db.execute(
            text("""
                UPDATE accounts_receivable
                SET saldo_pendiente = :saldo, estado = :estado, ultimo_pago = NOW()
                WHERE id = :id
            """),
            {"saldo": float(nuevo_saldo_doc), "estado": nuevo_estado_doc, "id": str(doc.id)},
        )
        restante -= aplicado_doc

    await db.commit()
    await db.refresh(account)
    return {"success": True, "account": account, "pago_aplicado": float(pago_aplicado)}


async def get_movements(db: AsyncSession, account_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
    """Historial real de movimientos de la linea de credito -- unifica tres
    fuentes en vez de depender solo de credit_movements (que queda vacio para
    toda cuenta sincronizada desde Nemuha, porque ese sync recalcula
    saldo_utilizado agregado desde accounts_receivable en vez de generar
    movimientos discretos uno por uno):
      1. Facturas/ventas a credito reales (accounts_receivable)
      2. Pagos reales aplicados a esas facturas (receivable_payments + allocations)
      3. Movimientos nativos de esta app (compras/pagos hechos directo desde
         este modulo, via process_purchase/process_payment) -- la fuente
         original, que sigue existiendo para cuentas que no vienen de Nemuha."""
    account = await get_credit_account(db, account_id)
    if not account:
        return []
    cid = str(account.company_id)
    custid = str(account.customer_id)

    facturas = await db.execute(
        text("""
            SELECT id, numero_documento, fecha_emision AS fecha, monto_original AS monto,
                   estado, saldo_pendiente, tipo AS tipo_documento,
                   CASE WHEN estado = 'pendiente' THEN GREATEST(0, CURRENT_DATE - fecha_vencimiento) ELSE 0 END AS dias_mora
            FROM accounts_receivable
            WHERE company_id = :cid AND customer_id = :custid
        """),
        {"cid": cid, "custid": custid},
    )
    items = []
    for r in facturas.fetchall():
        # tipo_documento distingue una factura normal de un recargo por mora
        # aplicado (Fase 2) -- ambos viven en accounts_receivable como
        # documentos independientes, pero deben verse distinto en el historial.
        es_recargo = r.tipo_documento == "recargo_mora"
        items.append({
            "id": str(r.id), "tipo": "recargo_mora" if es_recargo else "compra", "fuente": "recargo_mora" if es_recargo else "factura",
            "monto": float(r.monto or 0), "fecha": r.fecha,
            "referencia": r.numero_documento, "estado": r.estado,
            "saldo_pendiente": float(r.saldo_pendiente or 0), "dias_mora": r.dias_mora,
        })

    pagos = await db.execute(
        text("""
            SELECT rpa.id, rp.fecha, rpa.monto, rp.forma_pago, rp.referencia
            FROM receivable_payment_allocations rpa
            JOIN receivable_payments rp ON rp.id = rpa.receivable_payment_id
            WHERE rp.company_id = :cid AND rp.customer_id = :custid
        """),
        {"cid": cid, "custid": custid},
    )
    for r in pagos.fetchall():
        items.append({
            "id": str(r.id), "tipo": "pago", "fuente": "pago",
            "monto": float(r.monto or 0), "fecha": r.fecha,
            "referencia": r.forma_pago or r.referencia or "Pago", "estado": None,
            "saldo_pendiente": None, "dias_mora": None,
        })

    nativos = await db.execute(
        select(CreditMovement).where(CreditMovement.credit_account_id == uuid.UUID(account_id))
    )
    for m in nativos.scalars().all():
        items.append({
            "id": str(m.id), "tipo": m.tipo, "fuente": "ajuste" if m.tipo == "ajuste" else m.tipo,
            "monto": float(m.monto or 0), "fecha": m.created_at.date() if m.created_at else None,
            "referencia": m.observaciones or m.referencia_type, "estado": None,
            "saldo_pendiente": None, "dias_mora": None,
        })

    items.sort(key=lambda x: x["fecha"] or date.min, reverse=True)
    return items[offset:offset + limit]


# ── Recargo por mora (Fase 2) ────────────────────────────────────────────
# Configurable por empresa, apagado por defecto, guardado en companies.config
# (columna JSON que ya existia para vertical/enabled_features, evita una
# migracion nueva solo para esto). El recargo se calcula en vivo para el
# preview -- solo se convierte en un cargo real (nuevo documento de AR +
# movimiento de credito) cuando alguien con rol Gerente/Finanzas ejecuta
# "aplicar", nunca automaticamente. Nunca se mezcla con el monto_original de
# la factura vencida: siempre es un documento nuevo, separado, tipo
# 'recargo_mora' -- asi la factura original nunca cambia de monto.

_MORA_CONFIG_KEY = "recargo_mora"
_MORA_CONFIG_DEFAULT = {"activo": False, "porcentaje_mensual": 2.0, "dias_gracia": 0}


async def get_mora_config(db: AsyncSession, company_id: str) -> MoraConfig:
    result = await db.execute(text("SELECT config FROM companies WHERE id = :cid"), {"cid": company_id})
    row = result.fetchone()
    config = (row.config or {}) if row else {}
    stored = config.get(_MORA_CONFIG_KEY, {}) if isinstance(config, dict) else {}
    merged = {**_MORA_CONFIG_DEFAULT, **stored}
    return MoraConfig(**merged)


async def update_mora_config(db: AsyncSession, company_id: str, data: MoraConfig) -> MoraConfig:
    result = await db.execute(text("SELECT config FROM companies WHERE id = :cid"), {"cid": company_id})
    row = result.fetchone()
    config = dict(row.config or {}) if row and row.config else {}
    config[_MORA_CONFIG_KEY] = data.model_dump()
    await db.execute(
        text("UPDATE companies SET config = CAST(:config AS json) WHERE id = :cid"),
        {"config": json.dumps(config), "cid": company_id},
    )
    await db.commit()
    return data


def calculate_mora_surcharge(monto_original: Decimal, dias_mora: int, config: MoraConfig) -> Decimal:
    """Recargo prorrateado por dia sobre una tasa mensual -- p.ej. 2% mensual
    con 45 dias de mora real (tras el descuento de dias de gracia) equivale a
    2% * 45/30 = 3% del monto original."""
    if not config.activo:
        return Decimal("0")
    dias_aplicables = dias_mora - config.dias_gracia
    if dias_aplicables <= 0:
        return Decimal("0")
    tasa = Decimal(str(config.porcentaje_mensual)) / Decimal("100")
    recargo = monto_original * tasa * (Decimal(dias_aplicables) / Decimal("30"))
    return recargo.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


async def _get_mora_candidates(db: AsyncSession, company_id: str, config: MoraConfig) -> list[dict]:
    """Facturas vencidas que todavia no tienen un recargo aplicado. La
    exclusion es por factura (no por cuenta): un recargo es un cargo
    unico por factura -- una vez aplicado, esa factura no vuelve a
    generar otro aunque seguya vencida y se llame "aplicar" de nuevo.
    Se rastrea via accounts_receivable.sale_id (libre para estos
    documentos, ya que un recargo no nace de una venta) apuntando al id
    de la factura original que lo origino."""
    result = await db.execute(
        text("""
            SELECT ar.id AS ar_id, ar.customer_id, c.razon_social AS customer_nombre, ca.id AS credit_account_id,
                   ar.monto_original, GREATEST(0, CURRENT_DATE - ar.fecha_vencimiento) AS dias_mora
            FROM accounts_receivable ar
            JOIN credit_accounts ca ON ca.customer_id = ar.customer_id AND ca.company_id = ar.company_id
            LEFT JOIN customers c ON c.id = ar.customer_id
            WHERE ar.company_id = :cid AND ar.estado = 'pendiente' AND ar.fecha_vencimiento < CURRENT_DATE
              AND ar.tipo <> 'recargo_mora'
              AND NOT EXISTS (
                  SELECT 1 FROM accounts_receivable rm
                  WHERE rm.company_id = ar.company_id AND rm.tipo = 'recargo_mora' AND rm.sale_id = ar.id
              )
        """),
        {"cid": company_id},
    )
    candidatos = []
    for r in result.fetchall():
        recargo = calculate_mora_surcharge(Decimal(str(r.monto_original)), int(r.dias_mora), config)
        if recargo <= 0:
            continue
        candidatos.append({
            "ar_id": r.ar_id, "customer_id": r.customer_id, "customer_nombre": r.customer_nombre,
            "credit_account_id": r.credit_account_id, "recargo": recargo,
        })
    return candidatos


async def get_mora_preview(db: AsyncSession, company_id: str) -> dict:
    config = await get_mora_config(db, company_id)
    if not config.activo:
        return {"config": config, "items": [], "total_recargo": 0.0}

    candidatos = await _get_mora_candidates(db, company_id, config)

    por_cuenta: dict[str, dict] = {}
    for c in candidatos:
        key = str(c["credit_account_id"])
        if key not in por_cuenta:
            por_cuenta[key] = {
                "credit_account_id": c["credit_account_id"],
                "customer_id": c["customer_id"],
                "customer_nombre": c["customer_nombre"],
                "documentos_afectados": 0,
                "recargo_total": Decimal("0"),
            }
        por_cuenta[key]["documentos_afectados"] += 1
        por_cuenta[key]["recargo_total"] += c["recargo"]

    items = [
        {**v, "recargo_total": float(v["recargo_total"])}
        for v in sorted(por_cuenta.values(), key=lambda x: x["recargo_total"], reverse=True)
    ]
    total = sum(i["recargo_total"] for i in items)
    return {"config": config, "items": items, "total_recargo": total}


async def apply_mora_surcharges(db: AsyncSession, company_id: str, user_id: str) -> dict:
    """Convierte el preview en cargos reales: un documento nuevo en
    accounts_receivable POR FACTURA vencida (tipo='recargo_mora', separado
    de la factura original, enlazado via sale_id) + un CreditMovement que
    ajusta saldo_utilizado por cuenta. Cada factura solo genera un recargo
    una vez -- _get_mora_candidates ya excluye las que ya lo tienen, asi
    que llamar "aplicar" dos veces seguidas no duplica cargos."""
    config = await get_mora_config(db, company_id)
    if not config.activo:
        return {"aplicados": 0, "total": 0.0}

    candidatos = await _get_mora_candidates(db, company_id, config)
    if not candidatos:
        return {"aplicados": 0, "total": 0.0}

    por_cuenta: dict[str, Decimal] = {}
    aplicados = 0
    for c in candidatos:
        numero = f"RM-{date.today().isoformat()}-{str(c['ar_id'])[:8]}"
        await db.execute(
            text("""
                INSERT INTO accounts_receivable
                    (company_id, customer_id, sale_id, numero_documento, fecha_emision,
                     fecha_vencimiento, moneda, monto_original, saldo_pendiente, tipo, estado)
                VALUES
                    (:company_id, :customer_id, :sale_id, :numero, NOW(),
                     CURRENT_DATE + INTERVAL '15 days', 'PYG', :monto, :monto, 'recargo_mora', 'pendiente')
            """),
            {
                "company_id": company_id, "customer_id": str(c["customer_id"]), "sale_id": str(c["ar_id"]),
                "numero": numero, "monto": float(c["recargo"]),
            },
        )
        key = str(c["credit_account_id"])
        por_cuenta[key] = por_cuenta.get(key, Decimal("0")) + c["recargo"]
        aplicados += 1

    total_aplicado = Decimal("0")
    for account_id, monto in por_cuenta.items():
        account_result = await db.execute(select(CreditAccount).where(CreditAccount.id == uuid.UUID(account_id)))
        account = account_result.scalar_one_or_none()
        if not account:
            continue
        saldo_anterior = Decimal(str(account.saldo_utilizado))
        account.saldo_utilizado += monto
        account.saldo_disponible -= monto
        db.add(CreditMovement(
            company_id=company_id,
            credit_account_id=account.id,
            customer_id=account.customer_id,
            tipo="recargo_mora",
            monto=monto,
            saldo_anterior=saldo_anterior,
            saldo_nuevo=account.saldo_utilizado,
            referencia_type="recargo_mora",
            observaciones=f"Recargo por mora aplicado por {user_id}",
        ))
        total_aplicado += monto

    await db.commit()
    return {"aplicados": aplicados, "total": float(total_aplicado)}


# ── Baja de incobrables / write-off (Fase 3) ──────────────────────────────
# Cualquier usuario puede solicitar la baja de una factura (la deteccion de
# candidatas vive en el aging/mora que ya existe) pero la baja real requiere
# Gerente Y Finanzas -- dos personas distintas, mismo control de dos slots
# que credit_approval_requests. Al completarse: la factura pasa a
# estado='incobrable' (sale de pendiente/aging) pero NO se toca
# saldo_utilizado de la linea de credito -- la deuda sigue siendo real y
# exigible, solo se reconoce contablemente como perdida esperada. Lo que si
# se hace es desactivar la cuenta de credito, para que el cliente no pueda
# seguir comprando a credito sin que alguien lo revise de nuevo.

async def request_writeoff(db: AsyncSession, company_id: str, data, user_id: str | None) -> dict:
    ar_result = await db.execute(
        text("SELECT id, customer_id, saldo_pendiente, estado, numero_documento FROM accounts_receivable WHERE id = :id AND company_id = :cid"),
        {"id": str(data.accounts_receivable_id), "cid": company_id},
    )
    ar = ar_result.fetchone()
    if not ar:
        return {"error": "Documento no encontrado"}
    if ar.estado != "pendiente":
        return {"error": f"El documento ya está en estado '{ar.estado}', no se puede dar de baja"}

    existing = await db.execute(
        text("SELECT id FROM receivable_writeoff_requests WHERE accounts_receivable_id = :id AND estado = 'pendiente'"),
        {"id": str(ar.id)},
    )
    if existing.fetchone():
        return {"error": "Ya existe una solicitud de baja pendiente para este documento"}

    account = await get_credit_account_by_customer(db, company_id, str(ar.customer_id))

    request = ReceivableWriteoffRequest(
        company_id=company_id,
        accounts_receivable_id=ar.id,
        customer_id=ar.customer_id,
        credit_account_id=account.id if account else None,
        monto=Decimal(str(ar.saldo_pendiente)),
        motivo=data.motivo,
        solicitado_por=uuid.UUID(user_id) if user_id else None,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return {"success": True, "request": request}


async def list_writeoff_requests(db: AsyncSession, company_id: str, estado: str | None = "pendiente") -> list[dict]:
    query = text("""
        SELECT wr.*, c.razon_social AS customer_nombre, ar.numero_documento
        FROM receivable_writeoff_requests wr
        LEFT JOIN customers c ON c.id = wr.customer_id
        LEFT JOIN accounts_receivable ar ON ar.id = wr.accounts_receivable_id
        WHERE wr.company_id = :cid
    """ + (" AND wr.estado = :estado" if estado else "") + " ORDER BY wr.created_at DESC")
    params = {"cid": company_id}
    if estado:
        params["estado"] = estado
    result = await db.execute(query, params)
    return [dict(row._mapping) for row in result.fetchall()]


async def approve_writeoff(db: AsyncSession, request_id: str, user_id: str, tenant_id: str) -> dict:
    from api.src.rbac.service import get_user_roles

    result = await db.execute(select(ReceivableWriteoffRequest).where(ReceivableWriteoffRequest.id == uuid.UUID(request_id)))
    request = result.scalar_one_or_none()
    if not request:
        return {"error": "Solicitud no encontrada"}
    if request.estado != "pendiente":
        return {"error": f"La solicitud ya está en estado '{request.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    # Mismo control de dos slots que approve_credit_request -- un llamado
    # llena UN solo slot, incluso si la persona tiene ambos roles.
    filled_now = None
    if "Gerente" in roles and not request.aprobado_gerente_id:
        request.aprobado_gerente_id = uuid.UUID(user_id)
        request.aprobado_gerente_at = datetime.now(timezone.utc)
        filled_now = "gerente"
    elif "Finanzas" in roles and not request.aprobado_finanzas_id:
        request.aprobado_finanzas_id = uuid.UUID(user_id)
        request.aprobado_finanzas_at = datetime.now(timezone.utc)
        filled_now = "finanzas"

    if not filled_now:
        return {"error": "No autorizado: se requiere rol Gerente o Finanzas (o ya aprobaste esta solicitud)"}

    await db.flush()

    completo = False
    if request.aprobado_gerente_id and request.aprobado_finanzas_id:
        request.estado = "aprobado"
        completo = True

        await db.execute(
            text("UPDATE accounts_receivable SET estado = 'incobrable' WHERE id = :id"),
            {"id": str(request.accounts_receivable_id)},
        )

        if request.credit_account_id:
            account_result = await db.execute(select(CreditAccount).where(CreditAccount.id == request.credit_account_id))
            account = account_result.scalar_one_or_none()
            if account:
                account.activo = False
                db.add(CreditMovement(
                    company_id=request.company_id,
                    credit_account_id=account.id,
                    customer_id=account.customer_id,
                    tipo="incobrable",
                    monto=Decimal(str(request.monto)),
                    saldo_anterior=Decimal(str(account.saldo_utilizado)),
                    saldo_nuevo=Decimal(str(account.saldo_utilizado)),
                    referencia_type="writeoff",
                    referencia_id=request.accounts_receivable_id,
                    observaciones=f"Baja de incobrable aprobada por Gerente+Finanzas. Motivo: {request.motivo}. Cuenta de crédito desactivada.",
                ))

        await db.flush()

    await db.commit()
    await db.refresh(request)
    return {"success": True, "request": request, "completo": completo}


async def reject_writeoff(db: AsyncSession, request_id: str, user_id: str, tenant_id: str, motivo: str) -> dict:
    from api.src.rbac.service import get_user_roles

    result = await db.execute(select(ReceivableWriteoffRequest).where(ReceivableWriteoffRequest.id == uuid.UUID(request_id)))
    request = result.scalar_one_or_none()
    if not request:
        return {"error": "Solicitud no encontrada"}
    if request.estado != "pendiente":
        return {"error": f"La solicitud ya está en estado '{request.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    if "Gerente" not in roles and "Finanzas" not in roles:
        return {"error": "No autorizado: se requiere rol Gerente o Finanzas"}

    request.estado = "rechazado"
    request.rechazado_por = uuid.UUID(user_id)
    request.rechazado_at = datetime.now(timezone.utc)
    request.rechazado_motivo = motivo

    await db.commit()
    await db.refresh(request)
    return {"success": True, "request": request}


# ── Dunning automático / recordatorios de cobro (Fase 4) ──────────────────
# Apagado por defecto -- manda mensajes reales a clientes por WhatsApp
# (via api.src.whatsapp.service.send_message_to_phone, que ya resuelve la
# config de Twilio de la empresa y no falla si no esta configurada, solo
# devuelve False). Un aviso por (cliente, umbral de dias de mora) -- se
# registra en dunning_notifications SOLO si el envio fue exitoso, para que
# si WhatsApp todavia no esta configurado el candidato se reintente en la
# proxima corrida en vez de darse por "ya avisado" sin haber mandado nada.

_DUNNING_CONFIG_KEY = "dunning"
_DUNNING_CONFIG_DEFAULT = {
    "activo": False,
    "buckets_dias": [3, 7, 15, 30],
    "mensaje_template": DunningConfig.model_fields["mensaje_template"].default,
}


async def get_dunning_config(db: AsyncSession, company_id: str) -> DunningConfig:
    result = await db.execute(text("SELECT config FROM companies WHERE id = :cid"), {"cid": company_id})
    row = result.fetchone()
    config = (row.config or {}) if row else {}
    stored = config.get(_DUNNING_CONFIG_KEY, {}) if isinstance(config, dict) else {}
    merged = {**_DUNNING_CONFIG_DEFAULT, **stored}
    return DunningConfig(**merged)


async def update_dunning_config(db: AsyncSession, company_id: str, data: DunningConfig) -> DunningConfig:
    result = await db.execute(text("SELECT config FROM companies WHERE id = :cid"), {"cid": company_id})
    row = result.fetchone()
    config = dict(row.config or {}) if row and row.config else {}
    config[_DUNNING_CONFIG_KEY] = data.model_dump()
    await db.execute(
        text("UPDATE companies SET config = :config WHERE id = :cid"),
        {"config": json.dumps(config), "cid": company_id},
    )
    await db.commit()
    return data


async def _get_dunning_candidates(db: AsyncSession, company_id: str, config: DunningConfig) -> list[dict]:
    if not config.activo or not config.buckets_dias:
        return []

    result = await db.execute(
        text("""
            SELECT ar.customer_id, c.razon_social AS customer_nombre, c.telefono,
                   SUM(ar.saldo_pendiente) AS monto_total,
                   MAX(GREATEST(0, CURRENT_DATE - ar.fecha_vencimiento)) AS dias_mora,
                   COUNT(*) AS documentos_count
            FROM accounts_receivable ar
            LEFT JOIN customers c ON c.id = ar.customer_id
            WHERE ar.company_id = :cid AND ar.estado = 'pendiente' AND ar.fecha_vencimiento < CURRENT_DATE
            GROUP BY ar.customer_id, c.razon_social, c.telefono
        """),
        {"cid": company_id},
    )
    rows = result.fetchall()

    buckets_sorted = sorted(config.buckets_dias, reverse=True)
    candidatos = []
    for r in rows:
        if not r.telefono:
            continue
        dias_mora = int(r.dias_mora)
        bucket = next((b for b in buckets_sorted if dias_mora >= b), None)
        if bucket is None:
            continue

        existing = await db.execute(
            text("SELECT id FROM dunning_notifications WHERE company_id = :cid AND customer_id = :custid AND bucket_dias = :bucket"),
            {"cid": company_id, "custid": str(r.customer_id), "bucket": bucket},
        )
        if existing.fetchone():
            continue

        candidatos.append({
            "customer_id": r.customer_id, "customer_nombre": r.customer_nombre, "telefono": r.telefono,
            "monto_total": float(r.monto_total), "dias_mora": dias_mora, "bucket_dias": bucket,
            "documentos_count": r.documentos_count,
        })
    return candidatos


async def get_dunning_preview(db: AsyncSession, company_id: str) -> dict:
    config = await get_dunning_config(db, company_id)
    candidatos = await _get_dunning_candidates(db, company_id, config)
    return {"config": config, "items": candidatos}


async def run_dunning(db: AsyncSession, company_id: str) -> dict:
    """Envia los recordatorios reales y los registra -- pensado para
    llamarse tanto manualmente (endpoint) como desde el scheduler diario."""
    from api.src.whatsapp.service import send_message_to_phone
    from api.src.companies.models import Company

    config = await get_dunning_config(db, company_id)
    candidatos = await _get_dunning_candidates(db, company_id, config)
    if not candidatos:
        return {"enviados": 0, "omitidos": 0}

    company_result = await db.execute(select(Company).where(Company.id == uuid.UUID(company_id)))
    company = company_result.scalar_one_or_none()
    empresa_nombre = company.nombre_fantasia or company.razon_social if company else ""

    enviados = 0
    omitidos = 0
    for c in candidatos:
        mensaje = config.mensaje_template.format(
            cliente=c["customer_nombre"] or "Cliente",
            empresa=empresa_nombre,
            monto=f"₲ {c['monto_total']:,.0f}".replace(",", "."),
            dias_mora=c["dias_mora"],
        )
        ok = await send_message_to_phone(db, company_id, c["telefono"], mensaje)
        if not ok:
            omitidos += 1
            continue

        await db.execute(
            text("""
                INSERT INTO dunning_notifications
                    (company_id, customer_id, bucket_dias, monto_total, documentos_count, telefono, mensaje)
                VALUES (:cid, :custid, :bucket, :monto, :docs, :tel, :msg)
                ON CONFLICT (company_id, customer_id, bucket_dias) DO NOTHING
            """),
            {
                "cid": company_id, "custid": str(c["customer_id"]), "bucket": c["bucket_dias"],
                "monto": c["monto_total"], "docs": c["documentos_count"], "tel": c["telefono"], "msg": mensaje,
            },
        )
        enviados += 1

    await db.commit()
    return {"enviados": enviados, "omitidos": omitidos}


# ── Anticipos de clientes (Fase 5) ─────────────────────────────────────────
# Dinero que el cliente adelanta antes de tener una factura contra la cual
# aplicarlo -- vive separado de accounts_receivable (no es un pago de un
# documento puntual) y separado de credit_accounts (no es limite de credito,
# es plata real que el cliente ya entrego). Un anticipo puede aplicarse a
# uno o varios documentos con el tiempo, por eso se trackea monto_disponible
# por separado de monto_total, igual que saldo_pendiente en accounts_receivable.

async def create_customer_advance(db: AsyncSession, company_id: str, data: CustomerAdvanceCreate, user_id: str | None) -> CustomerAdvance:
    monto = Decimal(str(data.monto))
    advance = CustomerAdvance(
        company_id=company_id,
        customer_id=data.customer_id,
        monto_total=monto,
        monto_disponible=monto,
        forma_pago=data.forma_pago,
        referencia=data.referencia,
        observaciones=data.observaciones,
        registrado_por=uuid.UUID(user_id) if user_id else None,
    )
    db.add(advance)
    await db.commit()
    await db.refresh(advance)
    return advance


async def list_customer_advances(db: AsyncSession, company_id: str, customer_id: str | None = None) -> list[CustomerAdvance]:
    query = select(CustomerAdvance, Customer.razon_social).join(
        Customer, Customer.id == CustomerAdvance.customer_id, isouter=True
    ).where(CustomerAdvance.company_id == company_id)
    if customer_id:
        query = query.where(CustomerAdvance.customer_id == uuid.UUID(customer_id))
    query = query.order_by(CustomerAdvance.created_at.desc())
    result = await db.execute(query)
    advances = []
    for advance, razon_social in result.all():
        advance.customer_nombre = razon_social
        advances.append(advance)
    return advances


async def get_customer_advance_balance(db: AsyncSession, company_id: str, customer_id: str) -> Decimal:
    result = await db.execute(
        text("SELECT COALESCE(SUM(monto_disponible), 0) FROM customer_advances WHERE company_id = :cid AND customer_id = :custid"),
        {"cid": company_id, "custid": customer_id},
    )
    return Decimal(str(result.scalar() or 0))


async def apply_advance(db: AsyncSession, company_id: str, advance_id: str, accounts_receivable_id: str, monto: Decimal, user_id: str | None) -> dict:
    advance_result = await db.execute(
        select(CustomerAdvance).where(CustomerAdvance.id == uuid.UUID(advance_id), CustomerAdvance.company_id == company_id)
    )
    advance = advance_result.scalar_one_or_none()
    if not advance:
        return {"error": "Anticipo no encontrado"}
    if Decimal(str(advance.monto_disponible)) < monto:
        return {"error": f"El anticipo solo tiene {advance.monto_disponible} disponibles"}

    ar_result = await db.execute(
        text("SELECT id, saldo_pendiente, estado, customer_id FROM accounts_receivable WHERE id = :id AND company_id = :cid"),
        {"id": accounts_receivable_id, "cid": company_id},
    )
    ar = ar_result.fetchone()
    if not ar:
        return {"error": "Documento no encontrado"}
    if ar.estado != "pendiente":
        return {"error": f"El documento ya está en estado '{ar.estado}'"}
    if str(ar.customer_id) != str(advance.customer_id):
        return {"error": "El anticipo y el documento deben ser del mismo cliente"}
    if Decimal(str(ar.saldo_pendiente)) < monto:
        return {"error": "El monto supera el saldo pendiente del documento"}

    nuevo_saldo_doc = Decimal(str(ar.saldo_pendiente)) - monto
    nuevo_estado_doc = "pagado" if nuevo_saldo_doc <= 0 else "pendiente"
    await db.execute(
        text("UPDATE accounts_receivable SET saldo_pendiente = :saldo, estado = :estado, ultimo_pago = NOW() WHERE id = :id"),
        {"saldo": float(max(Decimal("0"), nuevo_saldo_doc)), "estado": nuevo_estado_doc, "id": accounts_receivable_id},
    )

    advance.monto_disponible = Decimal(str(advance.monto_disponible)) - monto
    await db.execute(
        text("""
            INSERT INTO customer_advance_applications (customer_advance_id, accounts_receivable_id, monto, aplicado_por)
            VALUES (:advance_id, :ar_id, :monto, :user_id)
        """),
        {"advance_id": advance_id, "ar_id": accounts_receivable_id, "monto": float(monto), "user_id": user_id},
    )

    await db.commit()
    return {
        "success": True, "monto_disponible_restante": float(advance.monto_disponible),
        "saldo_pendiente_documento": float(max(Decimal("0"), nuevo_saldo_doc)), "estado_documento": nuevo_estado_doc,
    }
