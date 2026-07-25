from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
import uuid

from api.src.integrated_finance.models import (
    WithholdingConfig, WithholdingDocument,
    AccountingPeriod, AccountingEntry, AccountPlan,
    CollectionAction, CustomerScore,
)
from api.src.sales.models import Sale
from api.src.integrated_finance.schemas import (
    WithholdingConfigCreate, WithholdingConfigUpdate,
    WithholdingDocumentCreate,
    AccountPlanCreate,
    AccountingPeriodCreate,
    AccountingEntryCreate,
    CollectionActionCreate,
    ConsolidatedDashboard,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _today():
    return date.today()

def _now():
    return datetime.now(timezone.utc)

def _month_range(anio: int, mes: int) -> tuple[date, date]:
    import calendar
    inicio = date(anio, mes, 1)
    ultimo_dia = calendar.monthrange(anio, mes)[1]
    fin = date(anio, mes, ultimo_dia)
    return inicio, fin


# ── WITHHOLDING CONFIG ───────────────────────────────────────────────────────

async def list_withholding_configs(db: AsyncSession, company_id: str, tipo: str | None = None):
    q = select(WithholdingConfig).where(WithholdingConfig.company_id == uuid.UUID(company_id))
    if tipo:
        q = q.where(WithholdingConfig.tipo == tipo)
    q = q.order_by(WithholdingConfig.supplier_id)
    r = await db.execute(q)
    return list(r.scalars().all())


async def create_withholding_config(db: AsyncSession, data: WithholdingConfigCreate):
    cfg = WithholdingConfig(
        company_id=uuid.UUID(data.company_id),
        supplier_id=uuid.UUID(data.supplier_id),
        tipo=data.tipo,
        categoria=data.categoria,
        tasa=Decimal(str(data.tasa)),
        base_minima=Decimal(str(data.base_minima or 0)),
        exento_hasta=Decimal(str(data.exento_hasta or 0)),
        regimen=data.regimen,
    )
    db.add(cfg)
    await db.flush()
    await db.refresh(cfg)
    return cfg


async def update_withholding_config(db: AsyncSession, config_id: str, data: WithholdingConfigUpdate):
    r = await db.execute(select(WithholdingConfig).where(WithholdingConfig.id == uuid.UUID(config_id)))
    cfg = r.scalar_one_or_none()
    if not cfg:
        return None
    if data.tasa is not None:
        cfg.tasa = Decimal(str(data.tasa))
    if data.categoria is not None:
        cfg.categoria = data.categoria
    if data.base_minima is not None:
        cfg.base_minima = Decimal(str(data.base_minima))
    if data.exento_hasta is not None:
        cfg.exento_hasta = Decimal(str(data.exento_hasta))
    if data.regimen is not None:
        cfg.regimen = data.regimen
    if data.activo is not None:
        cfg.activo = data.activo
    await db.flush()
    await db.refresh(cfg)
    return cfg


async def get_withholding_dashboard(db: AsyncSession, company_id: str):
    cid = uuid.UUID(company_id)
    pend_q = await db.execute(
        select(func.count(), func.coalesce(func.sum(WithholdingDocument.monto_retenido), 0))
        .where(WithholdingDocument.company_id == cid, WithholdingDocument.estado == "pendiente")
    )
    pend_count, pend_monto = pend_q.one()

    env_q = await db.execute(
        select(func.count(), func.coalesce(func.sum(WithholdingDocument.monto_retenido), 0))
        .where(WithholdingDocument.company_id == cid, WithholdingDocument.estado == "enviado")
    )
    env_count, env_monto = env_q.one()

    return {
        "total_retenciones_pendientes": pend_count,
        "monto_total_pendiente": float(pend_monto or 0),
        "total_retenciones_enviadas": env_count,
        "monto_total_enviado": float(env_monto or 0),
        "por_tipo": {},
    }


# ── WITHHOLDING DOCUMENTS ────────────────────────────────────────────────────

async def list_withholding_documents(
    db: AsyncSession, company_id: str, tipo: str | None = None, estado: str | None = None, limit: int = 50, offset: int = 0
):
    q = select(WithholdingDocument).where(WithholdingDocument.company_id == uuid.UUID(company_id))
    if tipo:
        q = q.where(WithholdingDocument.tipo == tipo)
    if estado:
        q = q.where(WithholdingDocument.estado == estado)
    q = q.order_by(WithholdingDocument.fecha_emision.desc()).offset(offset).limit(limit)
    r = await db.execute(q)
    return list(r.scalars().all())


async def create_withholding_document(db: AsyncSession, data: WithholdingDocumentCreate, user_id: str | None = None):
    cfg_q = await db.execute(
        select(WithholdingConfig).where(
            WithholdingConfig.company_id == uuid.UUID(data.company_id),
            WithholdingConfig.supplier_id == uuid.UUID(data.supplier_id),
            WithholdingConfig.tipo == data.tipo,
            WithholdingConfig.activo == True,
        )
    )
    cfg = cfg_q.scalar_one_or_none()
    if not cfg:
        return None

    monto_retenido = Decimal(str(data.base_imponible)) * (cfg.tasa / Decimal("100"))
    if monto_retenido < Decimal("0"):
        monto_retenido = Decimal("0")

    doc = WithholdingDocument(
        company_id=uuid.UUID(data.company_id),
        supplier_id=uuid.UUID(data.supplier_id),
        invoice_id=uuid.UUID(data.invoice_id),
        tipo=data.tipo,
        fecha_emision=_today(),
        periodo_fiscal=data.periodo_fiscal,
        base_imponible=Decimal(str(data.base_imponible)),
        tasa=cfg.tasa,
        monto_retenido=monto_retenido,
        moneda=data.moneda,
        notas=data.notas,
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    doc.numero_documento = f"RET-{doc.tipo}-{_today().strftime('%Y%m')}-{str(doc.id)[:8].upper()}"
    await db.flush()
    await db.refresh(doc)
    return doc


async def approve_withholding_document(db: AsyncSession, doc_id: str):
    r = await db.execute(select(WithholdingDocument).where(WithholdingDocument.id == uuid.UUID(doc_id)))
    doc = r.scalar_one_or_none()
    if not doc or doc.estado != "pendiente":
        return None
    doc.estado = "aprobado"
    await db.flush()
    await db.refresh(doc)
    return doc


async def send_withholding_to_sifen(db: AsyncSession, doc_id: str):
    r = await db.execute(select(WithholdingDocument).where(WithholdingDocument.id == uuid.UUID(doc_id)))
    doc = r.scalar_one_or_none()
    if not doc or doc.estado not in ("aprobado", "pendiente"):
        return None
    doc.estado = "enviado"
    doc.fecha_envio_sifen = _now()
    doc.cdc = f"CDC-{str(doc.id)[:16].upper()}"
    await db.flush()
    await db.refresh(doc)
    return doc


# ── ACCOUNT PLAN ──────────────────────────────────────────────────────────────

async def list_account_plans(db: AsyncSession, company_id: str):
    q = select(AccountPlan).where(AccountPlan.company_id == uuid.UUID(company_id)).order_by(AccountPlan.codigo)
    r = await db.execute(q)
    return list(r.scalars().all())


async def create_account_plan(db: AsyncSession, data: AccountPlanCreate):
    plan = AccountPlan(
        company_id=uuid.UUID(data.company_id),
        codigo=data.codigo,
        nombre=data.nombre,
        tipo=data.tipo,
        nivel=data.nivel,
        padre_id=uuid.UUID(data.padre_id) if data.padre_id else None,
        acepta_asientos=data.acepta_asientos,
    )
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    return plan


# ── ACCOUNTING PERIOD ─────────────────────────────────────────────────────────

async def list_accounting_periods(db: AsyncSession, company_id: str):
    q = select(AccountingPeriod).where(AccountingPeriod.company_id == uuid.UUID(company_id)).order_by(AccountingPeriod.anio.desc(), AccountingPeriod.mes.desc())
    r = await db.execute(q)
    return list(r.scalars().all())


async def open_accounting_period(db: AsyncSession, data: AccountingPeriodCreate):
    inicio, fin = _month_range(data.anio, data.mes)
    period = AccountingPeriod(
        company_id=uuid.UUID(data.company_id),
        anio=data.anio,
        mes=data.mes,
        fecha_inicio=inicio,
        fecha_fin=fin,
        estado="abierto",
    )
    db.add(period)
    await db.flush()
    await db.refresh(period)
    return period


async def close_accounting_period(db: AsyncSession, period_id: str, user_id: str | None = None):
    r = await db.execute(select(AccountingPeriod).where(AccountingPeriod.id == uuid.UUID(period_id)))
    period = r.scalar_one_or_none()
    if not period or period.estado != "abierto":
        return None
    period.estado = "cerrado"
    period.fecha_cierre = _now()
    if user_id:
        period.cerrado_por = uuid.UUID(user_id)
    await db.flush()
    await db.refresh(period)
    return period


async def get_trial_balance(db: AsyncSession, company_id: str, period_id: str) -> dict:
    cid = uuid.UUID(company_id)
    pid = uuid.UUID(period_id)

    r = await db.execute(select(AccountingPeriod).where(AccountingPeriod.id == pid))
    period = r.scalar_one_or_none()
    if not period:
        return {"periodo": "", "items": [], "total_debe": 0, "total_haber": 0}

    accounts_r = await db.execute(
        select(AccountPlan).where(AccountPlan.company_id == cid).order_by(AccountPlan.codigo)
    )
    accounts = list(accounts_r.scalars().all())

    entries_r = await db.execute(
        select(AccountingEntry).where(
            AccountingEntry.company_id == cid,
            AccountingEntry.period_id == pid,
        )
    )
    entries = list(entries_r.scalars().all())

    balances = {}
    for e in entries:
        aid = str(e.account_id)
        if aid not in balances:
            balances[aid] = {"debe": 0, "haber": 0}
        if e.tipo == "debe":
            balances[aid]["debe"] += float(e.monto)
        else:
            balances[aid]["haber"] += float(e.monto)

    items = []
    total_debe = 0
    total_haber = 0
    for ac in accounts:
        b = balances.get(str(ac.id), {"debe": 0, "haber": 0})
        saldo = b["debe"] - b["haber"] if ac.tipo in ("activo", "gasto") else b["haber"] - b["debe"]
        items.append({
            "account_id": str(ac.id),
            "codigo": ac.codigo,
            "nombre": ac.nombre,
            "tipo": ac.tipo,
            "nivel": ac.nivel,
            "debe": round(b["debe"], 2),
            "haber": round(b["haber"], 2),
            "saldo": round(saldo, 2),
        })
        total_debe += b["debe"]
        total_haber += b["haber"]

    return {
        "periodo": f"{period.anio}-{period.mes:02d}",
        "items": items,
        "total_debe": round(total_debe, 2),
        "total_haber": round(total_haber, 2),
    }


async def get_pnl(db: AsyncSession, company_id: str, period_id: str) -> dict:
    cid = uuid.UUID(company_id)
    pid = uuid.UUID(period_id)

    r = await db.execute(select(AccountingPeriod).where(AccountingPeriod.id == pid))
    period = r.scalar_one_or_none()
    if not period:
        return {"periodo": "", "ingresos": [], "costos": [], "gastos": [], "resultado_neto": 0}

    accounts_r = await db.execute(
        select(AccountPlan).where(AccountPlan.company_id == cid)
    )
    accounts = {str(a.id): a for a in list(accounts_r.scalars().all())}

    entries_r = await db.execute(
        select(AccountingEntry).where(
            AccountingEntry.company_id == cid,
            AccountingEntry.period_id == pid,
        )
    )
    entries = list(entries_r.scalars().all())

    ingresos = []
    costos = []
    gastos = []
    total_ingresos = 0
    total_costos = 0
    total_gastos = 0

    for e in entries:
        ac = accounts.get(str(e.account_id))
        if not ac:
            continue
        item = {"account_id": str(e.account_id), "codigo": ac.codigo, "nombre": ac.nombre, "monto": float(e.monto)}
        if ac.tipo == "ingreso":
            ingresos.append(item)
            total_ingresos += float(e.monto) if e.tipo == "haber" else -float(e.monto)
        elif ac.tipo == "costo":
            costos.append(item)
            total_costos += float(e.monto) if e.tipo == "debe" else -float(e.monto)
        elif ac.tipo == "gasto":
            gastos.append(item)
            total_gastos += float(e.monto) if e.tipo == "debe" else -float(e.monto)

    resultado_bruto = total_ingresos - total_costos
    resultado_operativo = resultado_bruto - total_gastos

    return {
        "periodo": f"{period.anio}-{period.mes:02d}",
        "ingresos": ingresos,
        "total_ingresos": round(total_ingresos, 2),
        "costos": costos,
        "total_costos": round(total_costos, 2),
        "gastos": gastos,
        "total_gastos": round(total_gastos, 2),
        "resultado_bruto": round(resultado_bruto, 2),
        "resultado_operativo": round(resultado_operativo, 2),
        "resultado_neto": round(resultado_operativo, 2),
    }


async def post_accounting_entry(db: AsyncSession, data: AccountingEntryCreate, user_id: str | None = None):
    entry = AccountingEntry(
        company_id=uuid.UUID(data.company_id),
        period_id=uuid.UUID(data.period_id),
        account_id=uuid.UUID(data.account_id),
        fecha=data.fecha,
        tipo=data.tipo,
        monto=Decimal(str(data.monto)),
        concepto=data.concepto,
        referencia_tipo=data.referencia_tipo,
        referencia_id=uuid.UUID(data.referencia_id) if data.referencia_id else None,
        asiento_numero=data.asiento_numero,
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


# ── COLLECTION ACTIONS ────────────────────────────────────────────────────────

async def list_collection_actions(
    db: AsyncSession, company_id: str, customer_id: str | None = None, limit: int = 50, offset: int = 0
):
    q = select(CollectionAction).where(CollectionAction.company_id == uuid.UUID(company_id))
    if customer_id:
        q = q.where(CollectionAction.customer_id == uuid.UUID(customer_id))
    q = q.order_by(CollectionAction.fecha.desc()).offset(offset).limit(limit)
    r = await db.execute(q)
    return list(r.scalars().all())


async def create_collection_action(db: AsyncSession, data: CollectionActionCreate, user_id: str | None = None):
    action = CollectionAction(
        company_id=uuid.UUID(data.company_id),
        customer_id=uuid.UUID(data.customer_id),
        receivable_id=uuid.UUID(data.receivable_id) if data.receivable_id else None,
        tipo=data.tipo,
        resultado=data.resultado,
        notas=data.notas,
        contacto=data.contacto,
        proximo_contacto=data.proximo_contacto,
        compromiso_pago=data.compromiso_pago,
        monto_comprometido=Decimal(str(data.monto_comprometido)) if data.monto_comprometido else None,
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(action)
    await db.flush()
    await db.refresh(action)
    return action


async def get_collection_dashboard(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    today = _today()

    total = await db.execute(
        select(func.count()).where(CollectionAction.company_id == cid)
    )
    total_count = total.scalar() or 0

    last_30d = await db.execute(
        select(func.count()).where(
            CollectionAction.company_id == cid,
            CollectionAction.fecha >= today - timedelta(days=30),
        )
    )
    last_count = last_30d.scalar() or 0

    promesas = await db.execute(
        select(func.count()).where(
            CollectionAction.company_id == cid,
            CollectionAction.compromiso_pago.isnot(None),
            CollectionAction.compromiso_pago >= today,
        )
    )
    promesas_count = promesas.scalar() or 0

    monto_promesas = await db.execute(
        select(func.coalesce(func.sum(CollectionAction.monto_comprometido), 0)).where(
            CollectionAction.company_id == cid,
            CollectionAction.compromiso_pago.isnot(None),
            CollectionAction.compromiso_pago >= today,
        )
    )
    monto = float(monto_promesas.scalar() or 0)

    return {
        "total_acciones": total_count,
        "acciones_30d": last_count,
        "promesas_pago_activas": promesas_count,
        "monto_comprometido": monto,
    }


# ── CUSTOMER SCORING ──────────────────────────────────────────────────────────

async def get_customer_score(db: AsyncSession, company_id: str, customer_id: str):
    r = await db.execute(
        select(CustomerScore).where(
            CustomerScore.company_id == uuid.UUID(company_id),
            CustomerScore.customer_id == uuid.UUID(customer_id),
        )
    )
    return r.scalar_one_or_none()


async def list_customer_scores(db: AsyncSession, company_id: str, min_score: int | None = None):
    q = select(CustomerScore).where(CustomerScore.company_id == uuid.UUID(company_id))
    if min_score is not None:
        q = q.where(CustomerScore.score >= min_score)
    q = q.order_by(CustomerScore.score.asc())
    r = await db.execute(q)
    return list(r.scalars().all())


async def recalculate_score(db: AsyncSession, company_id: str, customer_id: str):
    cid = company_id
    cuid = customer_id

    sales_r = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.company_id == uuid.UUID(cid),
            Sale.customer_id == uuid.UUID(cuid),
            Sale.estado != 'anulado',
        )
    )
    saldo_pendiente = float(ar_r.scalar() or 0)

    ar_count = await db.execute(
        text("SELECT COUNT(*) FROM accounts_receivable WHERE company_id = :cid AND customer_id = :cuid AND estado = 'vencido'"),
        {"cid": cid, "cuid": cuid},
    )
    docs_vencidos = ar_count.scalar() or 0

    sales_r = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.company_id == uuid.UUID(cid),
            Sale.customer_id == uuid.UUID(cuid),
            Sale.estado != 'anulado',
        )
    )
    total_compras = float(sales_r.scalar() or 0)

    payment_count = await db.execute(
        text("SELECT COUNT(*) FROM accounts_receivable WHERE company_id = :cid AND customer_id = :cuid AND estado = 'pagado'"),
        {"cid": cid, "cuid": cuid},
    )
    total_pagos = payment_count.scalar() or 0
    total_docs = await db.execute(
        text("SELECT COUNT(*) FROM accounts_receivable WHERE company_id = :cid AND customer_id = :cuid"),
        {"cid": cid, "cuid": cuid},
    )
    total_docs_count = total_docs.scalar() or 0

    pago_puntual = 100.0
    if total_docs_count > 0:
        pago_puntual = round(total_pagos / total_docs_count * 100, 2)

    dias_mora_prom = await db.execute(
        text("SELECT COALESCE(AVG(dias_mora), 0) FROM accounts_receivable WHERE company_id = :cid AND customer_id = :cuid AND dias_mora > 0"),
        {"cid": cid, "cuid": cuid},
    )
    dias_mora_promedio = round(float(dias_mora_prom.scalar() or 0), 1)

    antiguity = 0
    first_sale = await db.execute(
        select(Sale.fecha).where(
            Sale.company_id == cid,
            Sale.customer_id == cuid,
            Sale.estado != 'anulado',
        ).order_by(Sale.fecha.asc()).limit(1)
    )
    f = first_sale.scalar_one_or_none()
    if f:
        antiguity = (_today() - f.date()).days if hasattr(f, 'date') else 0

    score = 100
    if saldo_pendiente > 0:
        score -= min(int(saldo_pendiente / 100000), 20)
    if docs_vencidos > 0:
        score -= min(docs_vencidos * 5, 30)
    if dias_mora_promedio > 0:
        score -= min(int(dias_mora_promedio / 10), 25)
    if antiguity < 90:
        score -= 10
    elif antiguity > 365:
        score += 5
    if pago_puntual < 50:
        score -= 15
    elif pago_puntual > 90:
        score += 5
    score = max(0, min(100, score))

    r = await db.execute(
        select(CustomerScore).where(
            CustomerScore.company_id == cid,
            CustomerScore.customer_id == cuid,
        )
    )
    existing = r.scalar_one_or_none()
    if existing:
        existing.score = score
        existing.pago_puntual = Decimal(str(pago_puntual))
        existing.dias_mora_promedio = Decimal(str(dias_mora_promedio))
        existing.antiguedad_dias = antiguity
        existing.total_compras = Decimal(str(total_compras))
        existing.total_pagos = Decimal(str(total_pagos))
        existing.veces_mora = docs_vencidos
        existing.ultima_actualizacion = _now()
        sc = existing
    else:
        sc = CustomerScore(
            company_id=cid,
            customer_id=cuid,
            score=score,
            pago_puntual=Decimal(str(pago_puntual)),
            dias_mora_promedio=Decimal(str(dias_mora_promedio)),
            antiguedad_dias=antiguity,
            total_compras=Decimal(str(total_compras)),
            total_pagos=Decimal(str(total_pagos)),
            veces_mora=docs_vencidos,
        )
        db.add(sc)
    await db.flush()
    await db.refresh(sc)
    return sc


# ── EBITDA ────────────────────────────────────────────────────────────────────

async def compute_ebitda(db: AsyncSession, company_id: str, month: str | None = None) -> dict:
    cid = uuid.UUID(company_id)

    from api.src.sales.models import Sale

    today = _today()
    current_month = month or today.strftime("%Y-%m")
    year, mes_num = current_month.split("-")
    y, m = int(year), int(mes_num)
    inicio, fin = _month_range(y, m)

    sales_r = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.company_id == cid,
            Sale.estado != 'anulado',
            func.date(Sale.fecha) >= inicio,
            func.date(Sale.fecha) <= fin,
        )
    )
    ingresos_netos = float(sales_r.scalar() or 0)

    from api.src.financial.models import SupplierInvoice
    purchases_r = await db.execute(
        select(func.coalesce(func.sum(SupplierInvoice.total), 0)).where(
            SupplierInvoice.company_id == cid,
            SupplierInvoice.fecha_emision >= inicio,
            SupplierInvoice.fecha_emision <= fin,
        )
    )
    costo_ventas = float(purchases_r.scalar() or 0)

    gastos_operativos = 0
    expense_cats = ["gasto", "servicio", "alquiler", "salario", "marketing", "administrativo"]
    for cat in expense_cats:
        cat_r = await db.execute(
            select(func.coalesce(func.sum(SupplierInvoice.total), 0)).where(
                SupplierInvoice.company_id == cid,
                SupplierInvoice.fecha_emision >= inicio,
                SupplierInvoice.fecha_emision <= fin,
                SupplierInvoice.concepto.ilike(f"%{cat}%"),
            )
        )
        gastos_operativos += float(cat_r.scalar() or 0)

    resultado_bruto = ingresos_netos - costo_ventas
    ebitda = resultado_bruto - gastos_operativos
    margen_ebitda = round((ebitda / ingresos_netos * 100) if ingresos_netos > 0 else 0, 2)

    return {
        "periodo": current_month,
        "ingresos_netos": round(ingresos_netos, 2),
        "costo_ventas": round(costo_ventas, 2),
        "resultado_bruto": round(resultado_bruto, 2),
        "gastos_operativos": round(gastos_operativos, 2),
        "ebitda": round(ebitda, 2),
        "margen_ebitda": margen_ebitda,
    }


# ── AUTO RECONCILIATION ──────────────────────────────────────────────────────

async def auto_reconcile(db: AsyncSession, company_id: str, bank_account_id: str) -> dict:
    cid = uuid.UUID(company_id)
    baid = uuid.UUID(bank_account_id)

    from api.src.financial.models import BankTransaction, SupplierInvoicePayment

    conciliadas = 0
    monto_conciliado = 0
    detalle = []

    bank_txns = await db.execute(
        select(BankTransaction).where(
            BankTransaction.company_id == cid,
            BankTransaction.bank_account_id == baid,
            BankTransaction.conciliado == False,
        ).order_by(BankTransaction.fecha.desc())
    )
    transactions = list(bank_txns.scalars().all())

    for txn in transactions:
        matched = False
        monto_txn = float(txn.monto)

        if txn.tipo == "credito":
            ar_q = await db.execute(
                text("""
                    SELECT id, monto_original FROM accounts_receivable
                    WHERE company_id = :cid AND estado IN ('pendiente', 'parcial')
                    AND ABS(COALESCE(monto_original, 0) - :monto) < 1000
                    LIMIT 5
                """),
                {"cid": company_id, "monto": monto_txn},
            )
            ar_docs = ar_q.fetchall()
            for ar in ar_docs:
                if abs(float(ar[1]) - monto_txn) < 1000:
                    txn.invoice_id = uuid.UUID(ar[0])
                    txn.conciliado = True
                    txn.fecha_conciliacion = _now()
                    matched = True
                    conciliadas += 1
                    monto_conciliado += monto_txn
                    detalle.append({
                        "transaction_id": str(txn.id),
                        "referencia": txn.referencia,
                        "monto": monto_txn,
                        "matched_with": str(ar[0]),
                        "tipo": "cobro",
                    })
                    break

        elif txn.tipo == "debito":
            pay_q = await db.execute(
                select(SupplierInvoicePayment).where(
                    SupplierInvoicePayment.monto == Decimal(str(monto_txn)),
                ).limit(5)
            )
            payments = list(pay_q.scalars().all())
            for p in payments:
                if abs(float(p.monto) - monto_txn) < 1000:
                    txn.invoice_id = p.invoice_id
                    txn.conciliado = True
                    txn.fecha_conciliacion = _now()
                    matched = True
                    conciliadas += 1
                    monto_conciliado += monto_txn
                    detalle.append({
                        "transaction_id": str(txn.id),
                        "referencia": txn.referencia,
                        "monto": monto_txn,
                        "matched_with": str(p.invoice_id),
                        "tipo": "pago",
                    })
                    break

        if not matched:
            detalle.append({
                "transaction_id": str(txn.id),
                "referencia": txn.referencia,
                "monto": monto_txn,
                "tipo": "no_conciliado",
            })

    await db.flush()

    no_conciliadas = len(transactions) - conciliadas
    monto_no_conciliado = sum(float(t.monto) for t in transactions if not t.conciliado)

    return {
        "conciliadas": conciliadas,
        "monto_conciliado": round(monto_conciliado, 2),
        "no_conciliadas": no_conciliadas,
        "monto_no_conciliado": round(monto_no_conciliado, 2),
        "detalle": detalle,
    }


# ── CONSOLIDATED DASHBOARD ───────────────────────────────────────────────────

async def get_consolidated_dashboard(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    today = _today()

    from api.src.financial.models import BankAccount, SupplierInvoice
    from api.src.credit_accounts.models import CreditAccount
    from api.src.sales.models import Sale

    ar_q = await db.execute(
        text("SELECT COALESCE(SUM(saldo_pendiente), 0) FROM accounts_receivable WHERE company_id = :cid AND estado IN ('pendiente', 'parcial', 'vencido')"),
        {"cid": company_id},
    )
    ar_total = float(ar_q.scalar() or 0)

    ap_q = await db.execute(
        select(func.coalesce(func.sum(SupplierInvoice.saldo_pendiente), 0)).where(
            SupplierInvoice.company_id == cid,
            SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]),
        )
    )
    ap_total = float(ap_q.scalar() or 0)

    bank_q = await db.execute(
        select(func.coalesce(func.sum(BankAccount.saldo_actual), 0)).where(
            BankAccount.company_id == cid, BankAccount.activo == True,
        )
    )
    saldo_bancario = float(bank_q.scalar() or 0)

    liquidity = round(saldo_bancario / ap_total, 2) if ap_total > 0 else 999.0
    quick_ratio = round((saldo_bancario + ar_total) / ap_total, 2) if ap_total > 0 else 999.0

    ar_aging_q = await db.execute(
        text("""
            SELECT customer_id, estado, SUM(saldo_pendiente) as monto
            FROM accounts_receivable
            WHERE company_id = :cid AND estado IN ('pendiente', 'parcial', 'vencido')
            GROUP BY customer_id, estado
        """),
        {"cid": company_id},
    )
    ar_aging = []
    for row in ar_aging_q:
        ar_aging.append({"customer_id": str(row[0]), "estado": row[1], "monto": float(row[2] or 0)})

    ap_aging_q = await db.execute(
        select(
            func.case(
                (SupplierInvoice.fecha_vencimiento < today, "vencido"),
                else_="por_vencer"
            ),
            func.sum(SupplierInvoice.saldo_pendiente),
        ).where(
            SupplierInvoice.company_id == cid,
            SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]),
        ).group_by(
            func.case(
                (SupplierInvoice.fecha_vencimiento < today, "vencido"),
                else_="por_vencer"
            ),
        )
    )
    ap_aging = []
    for row in ap_aging_q:
        ap_aging.append({"estado": row[0], "monto": float(row[1] or 0)})

    ebitda = 0
    ebitda_margin = 0
    ing_mes = 0
    gas_mes = 0
    current_period = today.strftime("%Y-%m")
    ebitda_data = await compute_ebitda(db, company_id, current_period)
    if ebitda_data:
        ebitda = ebitda_data["ebitda"]
        ebitda_margin = ebitda_data["margen_ebitda"]
        ing_mes = ebitda_data["ingresos_netos"]
        gas_mes = ebitda_data["gastos_operativos"]

    proy_30 = saldo_bancario + (ing_mes * 0.8) - (gas_mes * 0.9)
    proy_60 = proy_30 + (ing_mes * 0.7) - (gas_mes * 0.85)
    proy_90 = proy_60 + (ing_mes * 0.6) - (gas_mes * 0.8)

    ventas_anual_q = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.company_id == cid,
            Sale.estado != 'anulado',
            func.date(Sale.fecha) >= date(today.year - 1, today.month, 1),
        )
    )
    ventas_anuales = float(ventas_anual_q.scalar() or 0)
    rotacion_cartera = round(365 / (ventas_anuales / ar_total), 1) if ventas_anuales > 0 and ar_total > 0 else 0
    rotacion_prov = round(365 / (ventas_anuales / ap_total), 1) if ventas_anuales > 0 and ap_total > 0 else 0
    ciclo_efectivo = round(rotacion_cartera - rotacion_prov, 1)

    scoring_q = await db.execute(
        select(func.avg(CustomerScore.score)).where(CustomerScore.company_id == cid)
    )
    scoring_prom = round(float(scoring_q.scalar() or 0), 1)

    ret_q = await db.execute(
        select(func.count()).where(
            WithholdingDocument.company_id == cid,
            WithholdingDocument.estado == "pendiente",
        )
    )
    ret_pend = ret_q.scalar() or 0

    coll_q = await db.execute(
        select(func.count()).where(
            CollectionAction.company_id == cid,
            CollectionAction.fecha >= today,
        )
    )
    coll_pend = coll_q.scalar() or 0

    weeks_q = await db.execute(
        select(func.count()).where(
            AccountingPeriod.company_id == cid,
            AccountingPeriod.estado == "abierto",
        )
    )
    accounting_weeks = weeks_q.scalar() or 0

    return {
        "liquidez": liquidity,
        "liquidez_rapida": quick_ratio,
        "ebitda": round(ebitda, 2),
        "margen_ebitda": ebitda_margin,
        "resultado_neto": round(ing_mes - gas_mes, 2),
        "total_por_cobrar": round(ar_total, 2),
        "total_por_pagar": round(ap_total, 2),
        "saldo_bancario": round(saldo_bancario, 2),
        "proyeccion_30d": round(proy_30, 2),
        "proyeccion_60d": round(proy_60, 2),
        "proyeccion_90d": round(proy_90, 2),
        "rotacion_cartera_dias": rotacion_cartera,
        "rotacion_proveedores_dias": rotacion_prov,
        "ciclo_efectivo_dias": ciclo_efectivo,
        "ar_aging": ar_aging,
        "ap_aging": ap_aging,
        "ingresos_del_mes": round(ing_mes, 2),
        "gastos_del_mes": round(gas_mes, 2),
        "retenciones_pendientes": ret_pend,
        "colecciones_pendientes": coll_pend,
        "scoring_promedio": scoring_prom,
        "accounting_weeks": accounting_weeks,
    }
