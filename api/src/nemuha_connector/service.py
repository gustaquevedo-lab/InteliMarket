"""Conector Ñemuha (ConceptoComercial/FlexPDV) -> InteliMarket.

Alcance verificado contra la base real del cliente vía DESCRIBE + valores
reales (nunca asumidos):
    - bs_pessoa                    -> customers.Customer / suppliers.Supplier
    - fin_conta_pagar               -> financial.SupplierInvoice (cuentas por pagar)
    - fin_conta_receber             -> accounts_receivable (cuentas por cobrar)
    - bc_banco + bc_conta_banco     -> financial.BankAccount
    - bc_operacao_banco             -> financial.BankTransaction
        TP_OPERACAO decodificado en hex: 0x45='E' (Entrada/crédito, 6699 casos),
        0x53='S' (Saída/débito, 1523 casos) — confirmado contra datos reales.
        bc_conta_banco NO trae saldo propio (DESCRIBE confirmado, sin columna
        de saldo) — sync_bank_balances recalcula saldo_actual sumando las
        transacciones ya sincronizadas. Asume que bc_operacao_banco tiene el
        historial completo desde la apertura; si no, falta un saldo inicial
        que solo el cliente puede confirmar contra su extracto bancario real.
    - fin_gasto                     -> petty_cash.Expense (caja chica)
    - fin_fechamento_caixa_chica    -> finance_agent.FinanceRecommendation
        (tipo="control_caja_chica") cuando VL_DIFERENCA_* != 0 — el legacy ya
        calcula el sobrante/faltante de cada cierre, solo hay que sacarlo a la luz.
    - bs_moeda: 1=PYG, 2=USD, 3=BRL — tabla de 3 filas, verificada, estable.
    - ven_venda + ven_item_venda + est_produto -> consulta de ticket para
        IntelliZapp (get_ticket_detail). Lookup puntual en vivo, sin sync/caché.
        CD_VENDA = número de venta interno (verificado único: 116392 filas,
        116392 distintos) — NO confundir con NR_FATURA, que es el número fiscal.

Deliberadamente FUERA de esta versión:
    - fin_pagamento / fin_recebimento (detalle de pagos y cobros) — se usa por
      ahora solo el saldo pendiente ya calculado en la cabecera (VL_APAGAR / VL_ARECEBER)
    - con_nota_faturada (fiscal/SIFEN) — pendiente, se diseña junto al módulo sifen
    - bc_pagamento_com_cheque / bc_transferencia_conta — detalle de cheques y
      transferencias entre cuentas propias, se agrega en una segunda pasada

No inventar columnas para tablas nuevas — correr DESCRIBE + valores reales
contra la base real antes de extender este archivo.
"""

import asyncio
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

import pymysql
import pymysql.cursors
from sqlalchemy import select, text, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.config import settings
from api.src.nemuha_connector.models import NemuhaRecordMap, NemuhaSyncRun
from api.src.purchases.models import Supplier
from api.src.customers.models import Customer
from api.src.financial.models import SupplierInvoice, BankAccount, BankTransaction
from api.src.petty_cash.models import Expense
from api.src.finance_agent.models import FinanceAgentRun, FinanceRecommendation

MONEDA_MAP = {1: "PYG", 2: "USD", 3: "BRL"}  # bs_moeda — verificado contra datos reales
SYSTEM_RUN_MODEL = "system:nemuha-caja-chica-control"


def _legacy_connect() -> pymysql.connections.Connection:
    if not settings.nemuha_mysql_host:
        raise RuntimeError(
            "nemuha_mysql_host no configurado — cargar NEMUHA_MYSQL_* en .env "
            "(host/puerto/usuario/password/database de intelimarket_ro)"
        )
    return pymysql.connect(
        host=settings.nemuha_mysql_host,
        port=settings.nemuha_mysql_port,
        user=settings.nemuha_mysql_user,
        password=settings.nemuha_mysql_password,
        database=settings.nemuha_mysql_database,
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=10,
    )


def _fetch_sync(sql: str, params: tuple = ()) -> list[dict]:
    """Corre en un thread aparte — pymysql es sincrónico, no bloquear el event loop."""
    conn = _legacy_connect()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        conn.close()


async def _fetch(sql: str, params: tuple = ()) -> list[dict]:
    return await asyncio.to_thread(_fetch_sync, sql, params)


# ── Mapeo idempotente ──────────────────────────────────────────────────────────

async def _get_mapped_target(db: AsyncSession, company_id: str, source_table: str, source_pk: int) -> UUID | None:
    result = await db.execute(
        select(NemuhaRecordMap.target_id).where(
            NemuhaRecordMap.company_id == company_id,
            NemuhaRecordMap.source_table == source_table,
            NemuhaRecordMap.source_pk == source_pk,
        )
    )
    row = result.first()
    return row[0] if row else None


async def _save_map(db: AsyncSession, company_id: str, source_table: str, source_pk: int, target_table: str, target_id: UUID) -> None:
    db.add(NemuhaRecordMap(
        company_id=company_id, source_table=source_table, source_pk=source_pk,
        target_table=target_table, target_id=target_id,
    ))
    await db.flush()


# ── Resolución de terceros (bs_pessoa) ──────────────────────────────────────────

async def _resolve_pessoa(db: AsyncSession, company_id: str, id_pessoa: int, rol: Literal["customer", "supplier"]) -> UUID:
    source_table = f"bs_pessoa:{rol}"
    existing = await _get_mapped_target(db, company_id, source_table, id_pessoa)
    if existing:
        return existing

    rows = await _fetch(
        "SELECT ID_PESSOA, NOME, RUC, TELEFONE, EMAIL, ENDERECO FROM bs_pessoa WHERE ID_PESSOA = %s",
        (id_pessoa,),
    )
    if not rows:
        raise ValueError(f"bs_pessoa ID_PESSOA={id_pessoa} no encontrado en la base legacy")
    p = rows[0]

    if rol == "supplier":
        entity = Supplier(
            company_id=company_id,
            razon_social=p["NOME"] or f"Proveedor legacy #{id_pessoa}",
            ruc=p["RUC"], telefono=p["TELEFONE"], email=p["EMAIL"], direccion=p["ENDERECO"],
        )
        target_table = "suppliers"
    else:
        entity = Customer(
            company_id=company_id,
            razon_social=p["NOME"] or f"Cliente legacy #{id_pessoa}",
            ruc=p["RUC"], telefono=p["TELEFONE"], email=p["EMAIL"], direccion=p["ENDERECO"],
        )
        target_table = "customers"

    db.add(entity)
    await db.flush()
    await _save_map(db, company_id, source_table, id_pessoa, target_table, entity.id)
    return entity.id


# ── Cuentas por pagar (fin_conta_pagar) ─────────────────────────────────────────
#
# No confiar en SITUACAO/STATUS del legacy (valores reales no verificados aún) —
# derivar el estado desde montos, que sí están validados. El aging (vencido/por
# vencer) ya lo calculan dinámicamente financial.get_ap_aging y
# accounts_receivable.get_aging_report a partir de fecha_vencimiento — el estado
# guardado acá solo necesita marcar abierto vs. pagado vs. cancelado, con los
# mismos strings que ya usa el resto del código (ver financial/service.py y
# accounts_receivable/service.py — no son simétricos entre AP y AR).

def _ap_estado(saldo: Decimal, cancelado: bool) -> str:
    if cancelado:
        return "cancelada"
    return "pagada" if saldo <= 0 else "pendiente"


def _ar_estado(saldo: Decimal) -> str:
    return "pagado" if saldo <= 0 else "pendiente"


async def sync_accounts_payable(db: AsyncSession, company_id: str, since: date | None) -> int:
    sql = "SELECT * FROM fin_conta_pagar WHERE 1=1"
    params: tuple = ()
    if since:
        sql += " AND DT_CADASTRO >= %s"
        params = (since,)
    rows = await _fetch(sql, params)

    count = 0
    for r in rows:
        supplier_id = await _resolve_pessoa(db, company_id, r["ID_PESSOA"], "supplier")
        cancelado = bool(r["BO_CANCELADO"])
        saldo = Decimal(str(r["VL_APAGAR"]))
        estado = _ap_estado(saldo, cancelado)

        existing_id = await _get_mapped_target(db, company_id, "fin_conta_pagar", r["ID_CONTA_PAGAR"])
        if existing_id:
            await db.execute(
                text("UPDATE supplier_invoices SET saldo_pendiente = :saldo, estado = :estado, updated_at = now() WHERE id = :id"),
                {"saldo": saldo, "estado": estado, "id": str(existing_id)},
            )
        else:
            invoice = SupplierInvoice(
                company_id=company_id,
                supplier_id=supplier_id,
                numero_factura=r["NR_DOCUMENTO"] or f"CP-{r['ID_CONTA_PAGAR']}",
                fecha_emision=r["DT_EMISSAO"] or r["DT_CADASTRO"],
                fecha_vencimiento=r["DT_VENCIMENTO"],
                total=Decimal(str(r["VL_DOCUMENTO"])),
                saldo_pendiente=saldo,
                condicion="contado" if r["BO_AVISTA"] else "credito",
                estado=estado,
                concepto=r["HISTORICO"],
            )
            db.add(invoice)
            await db.flush()
            await _save_map(db, company_id, "fin_conta_pagar", r["ID_CONTA_PAGAR"], "supplier_invoices", invoice.id)
        count += 1

    return count


# ── Cuentas por cobrar (fin_conta_receber) ──────────────────────────────────────

async def sync_accounts_receivable(db: AsyncSession, company_id: str, since: date | None) -> int:
    sql = "SELECT * FROM fin_conta_receber WHERE 1=1"
    params: tuple = ()
    if since:
        sql += " AND DT_CADASTRO >= %s"
        params = (since,)
    rows = await _fetch(sql, params)

    count = 0
    for r in rows:
        customer_id = await _resolve_pessoa(db, company_id, r["ID_PESSOA"], "customer")
        saldo = Decimal(str(r["VL_ARECEBER"]))
        estado = _ar_estado(saldo)

        existing_id = await _get_mapped_target(db, company_id, "fin_conta_receber", r["ID_CONTA_RECEBER"])
        if existing_id:
            await db.execute(
                text("UPDATE accounts_receivable SET saldo_pendiente = :saldo, estado = :estado, updated_at = now() WHERE id = :id"),
                {"saldo": saldo, "estado": estado, "id": str(existing_id)},
            )
        else:
            result = await db.execute(
                text("""
                    INSERT INTO accounts_receivable
                        (company_id, customer_id, numero_documento, fecha_emision,
                         fecha_vencimiento, moneda, monto_original, saldo_pendiente, tipo, estado)
                    VALUES
                        (:company_id, :customer_id, :numero_documento, :fecha_emision,
                         :fecha_vencimiento, 'PYG', :monto, :saldo, 'factura', :estado)
                    RETURNING id
                """),
                {
                    "company_id": company_id,
                    "customer_id": str(customer_id),
                    "numero_documento": r["NR_DOCUMENTO"] or f"CR-{r['ID_CONTA_RECEBER']}",
                    "fecha_emision": r["DT_EMISSAO"],
                    "fecha_vencimiento": r["DT_VENCIMENTO"],
                    "monto": Decimal(str(r["VL_DOCUMENTO"])),
                    "saldo": saldo,
                    "estado": estado,
                },
            )
            new_id = result.scalar_one()
            await _save_map(db, company_id, "fin_conta_receber", r["ID_CONTA_RECEBER"], "accounts_receivable", new_id)
        count += 1

    return count


# ── Tesorería: bancos (bc_banco, bc_conta_banco, bc_operacao_banco) ─────────────

async def sync_bank_accounts(db: AsyncSession, company_id: str, since: date | None) -> int:
    rows = await _fetch("""
        SELECT c.ID_CONTA, c.DS_CONTA, c.NR_CONTA, c.ID_MOEDA, b.DS_BANCO
        FROM bc_conta_banco c JOIN bc_banco b ON b.ID_BANCO = c.ID_BANCO
        WHERE c.BO_ATIVO = 1
    """)
    count = 0
    for r in rows:
        existing_id = await _get_mapped_target(db, company_id, "bc_conta_banco", r["ID_CONTA"])
        if existing_id:
            count += 1
            continue
        account = BankAccount(
            company_id=company_id,
            banco=r["DS_BANCO"],
            tipo="cuenta_corriente",  # el legacy no distingue tipo de cuenta — valor por defecto, a confirmar con el cliente
            numero_cuenta=r["NR_CONTA"] or f"CTA-{r['ID_CONTA']}",
            moneda=MONEDA_MAP.get(r["ID_MOEDA"], "PYG"),
            titular=r["DS_CONTA"],
        )
        db.add(account)
        await db.flush()
        await _save_map(db, company_id, "bc_conta_banco", r["ID_CONTA"], "bank_accounts", account.id)
        count += 1
    return count


async def sync_bank_transactions(db: AsyncSession, company_id: str, since: date | None) -> int:
    # bc_operacao_banco no trae su propia moneda — hereda la de la cuenta (bc_conta_banco.ID_MOEDA).
    cuentas = await _fetch("SELECT ID_CONTA, ID_MOEDA FROM bc_conta_banco")
    moneda_por_conta = {c["ID_CONTA"]: MONEDA_MAP.get(c["ID_MOEDA"], "PYG") for c in cuentas}

    sql = "SELECT * FROM bc_operacao_banco WHERE BO_CANCELADO IS NULL OR BO_CANCELADO = 0"
    params: tuple = ()
    if since:
        sql += " AND DT_OPERACAO >= %s"
        params = (since,)
    rows = await _fetch(sql, params)

    count = 0
    for r in rows:
        bank_account_id = await _get_mapped_target(db, company_id, "bc_conta_banco", r["ID_CONTA"])
        if not bank_account_id:
            continue  # cuenta inactiva/no sincronizada — no inventar una cuenta nueva acá

        existing_id = await _get_mapped_target(db, company_id, "bc_operacao_banco", r["ID_OPERACAO"])
        if existing_id:
            count += 1
            continue

        tipo_op = r["TP_OPERACAO"]
        tipo_op = tipo_op.decode() if isinstance(tipo_op, (bytes, bytearray)) else tipo_op
        tipo = "credito" if tipo_op == "E" else "debito"  # E=Entrada, S=Saída — verificado contra datos reales

        txn = BankTransaction(
            company_id=company_id,
            bank_account_id=bank_account_id,
            fecha=r["DT_OPERACAO"],
            tipo=tipo,
            monto=Decimal(str(r["VL_DOCUMENTO"])),
            moneda=moneda_por_conta.get(r["ID_CONTA"], "PYG"),
            descripcion=r["OBSERVACAO"],
            referencia=r["NR_DOCUMENTO"],
            categoria="conciliacion_pendiente",
        )
        db.add(txn)
        await db.flush()
        await _save_map(db, company_id, "bc_operacao_banco", r["ID_OPERACAO"], "bank_transactions", txn.id)
        count += 1

    return count


# bc_conta_banco no trae un saldo propio en el legacy — se recalcula sumando las
# transacciones ya sincronizadas (crédito suma, débito resta). Asume que
# bc_operacao_banco tiene el historial completo desde la apertura de cada cuenta;
# si no es así, falta un saldo inicial que solo el cliente puede confirmar
# (ver pendiente de conciliación bancaria con el cliente).
async def sync_bank_balances(db: AsyncSession, company_id: str, since: date | None) -> int:
    accounts = (
        await db.execute(select(BankAccount).where(BankAccount.company_id == company_id))
    ).scalars().all()

    count = 0
    for acc in accounts:
        row = await db.execute(
            select(
                func.coalesce(func.sum(case((BankTransaction.tipo == "credito", BankTransaction.monto), else_=0)), 0),
                func.coalesce(func.sum(case((BankTransaction.tipo == "debito", BankTransaction.monto), else_=0)), 0),
            ).where(BankTransaction.bank_account_id == acc.id)
        )
        creditos, debitos = row.one()
        acc.saldo_actual = acc.saldo_inicial + Decimal(str(creditos)) - Decimal(str(debitos))
        db.add(acc)
        count += 1

    await db.flush()
    return count


# ── Caja chica: gastos (fin_gasto) y control de cierres (fin_fechamento_caixa_chica) ──

async def sync_petty_cash_expenses(db: AsyncSession, company_id: str, since: date | None) -> int:
    sql = "SELECT * FROM fin_gasto WHERE BO_CANCELADO = 0"
    params: tuple = ()
    if since:
        sql += " AND DT_GASTO >= %s"
        params = (since,)
    rows = await _fetch(sql, params)

    count = 0
    for r in rows:
        existing_id = await _get_mapped_target(db, company_id, "fin_gasto", r["ID_GASTO"])
        if existing_id:
            count += 1
            continue

        # Sin comprobante fiscal asociado -> queda en revisión (no autoaprobado),
        # usando el mismo campo "notas" que ya usa el módulo, sin inventar columnas.
        sin_comprobante = r["ID_NOTA_FISCAL"] is None and not r["NR_DOCUMENTO"]
        notas = "Sin comprobante fiscal en el sistema legacy — requiere revisión" if sin_comprobante else None

        expense = Expense(
            company_id=company_id,
            monto=Decimal(str(r["VL_GASTO"])),
            descripcion=r["DS_GASTO"],
            fecha_gasto=r["DT_GASTO"],
            tipo_pago="efectivo",
            notas=notas,
        )
        db.add(expense)
        await db.flush()
        await _save_map(db, company_id, "fin_gasto", r["ID_GASTO"], "expenses", expense.id)
        count += 1

    return count


async def _get_or_create_system_run(db: AsyncSession, company_id: str) -> FinanceAgentRun:
    """Recomendaciones basadas en reglas de datos (no en una corrida de Claude)
    cuelgan de una única corrida 'system' por empresa, para no forzar un run_id
    ficticio en cada recomendación."""
    result = await db.execute(
        select(FinanceAgentRun).where(
            FinanceAgentRun.company_id == company_id,
            FinanceAgentRun.model == SYSTEM_RUN_MODEL,
        )
    )
    run = result.scalar_one_or_none()
    if run:
        return run
    run = FinanceAgentRun(company_id=company_id, model=SYSTEM_RUN_MODEL, status="completed", diagnostico="Control automático de cierres de caja chica")
    db.add(run)
    await db.flush()
    return run


async def sync_petty_cash_control(db: AsyncSession, company_id: str, since: date | None) -> int:
    sql = "SELECT * FROM fin_fechamento_caixa_chica WHERE BO_CANCELADO IS NULL OR BO_CANCELADO = 0"
    params: tuple = ()
    if since:
        sql += " AND DT_FECHAMENTO >= %s"
        params = (since,)
    rows = await _fetch(sql, params)

    count = 0
    system_run = None
    for r in rows:
        existing_id = await _get_mapped_target(db, company_id, "fin_fechamento_caixa_chica", r["ID_FECHAMENTO_CAIXA_CHICA"])
        if existing_id:
            continue

        diffs = {
            "PYG": Decimal(str(r["VL_DIFERENCA_GUARANI"])),
            "USD": Decimal(str(r["VL_DIFERENCA_DOLAR"])),
            "BRL": Decimal(str(r["VL_DIFERENCA_REAL"])),
        }
        diffs_no_cero = {m: v for m, v in diffs.items() if v != 0}
        if not diffs_no_cero:
            # sin diferencia -> no genera recomendación, pero igual se marca
            # como procesado para no reprocesar en cada corrida. No hay fila
            # real que apuntar, así que se usa un UUID sintético (no un id de
            # tabla real) solo como marca de "ya visto".
            await _save_map(db, company_id, "fin_fechamento_caixa_chica", r["ID_FECHAMENTO_CAIXA_CHICA"], "none:sin_diferencia", uuid.uuid4())
            continue

        if system_run is None:
            system_run = await _get_or_create_system_run(db, company_id)

        detalle = ", ".join(f"{v:+,.2f} {m}" for m, v in diffs_no_cero.items())
        rec = FinanceRecommendation(
            company_id=company_id,
            run_id=system_run.id,
            tipo="control_caja_chica",
            titulo=f"Diferencia en cierre de caja chica del {r['DT_FECHAMENTO']}",
            descripcion=(
                f"El cierre registrado por {r['USUARIO']} el {r['DT_FECHAMENTO']} "
                f"presenta diferencia entre lo esperado y lo contado: {detalle}. "
                f"Dato calculado por el propio sistema legacy en el momento del cierre."
            ),
            entidad_relacionada=r["USUARIO"],
            monto_relacionado=detalle,
        )
        db.add(rec)
        await db.flush()
        await _save_map(db, company_id, "fin_fechamento_caixa_chica", r["ID_FECHAMENTO_CAIXA_CHICA"], "finance_recommendations", rec.id)
        count += 1

    return count


# ── Orquestador ──────────────────────────────────────────────────────────────

async def run_sync(db: AsyncSession, company_id: str, since: date | None = None) -> NemuhaSyncRun:
    run = NemuhaSyncRun(company_id=company_id, since_date=since, status="running")
    db.add(run)
    await db.flush()

    rows_synced: dict[str, int] = {}
    errors: dict[str, str] = {}

    for name, fn in (
        ("accounts_payable", sync_accounts_payable),
        ("accounts_receivable", sync_accounts_receivable),
        ("bank_accounts", sync_bank_accounts),
        ("bank_transactions", sync_bank_transactions),
        ("bank_balances", sync_bank_balances),
        ("petty_cash_expenses", sync_petty_cash_expenses),
        ("petty_cash_control", sync_petty_cash_control),
    ):
        try:
            rows_synced[name] = await fn(db, company_id, since)
            await db.commit()
        except Exception as e:  # noqa: BLE001 — un área que falla no debe tumbar el resto
            await db.rollback()
            errors[name] = str(e)

    run.status = "error" if errors and not rows_synced else ("partial" if errors else "success")
    run.finished_at = datetime.utcnow()
    run.rows_synced = rows_synced
    run.errors = errors or None
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


# ── Consulta de ticket para IntelliZapp (segmentación de marketing) ────────────
# Lectura en vivo contra la base legacy — no hay sync/caché, es un lookup puntual
# por CD_VENDA (número de venta interno, verificado único contra datos reales).
# ven_venda.CD_VENDA -> numero_ticket que maneja IntelliZapp (NO es NR_FATURA,
# que es el número fiscal/SIFEN — confirmado con Gustavo).

async def get_ticket_detail(numero_ticket: str) -> dict | None:
    ventas = await _fetch(
        """
        SELECT v.ID_VENDA, v.CD_VENDA, v.DT_VENDA, v.VL_TOTAL, v.BO_CANCELADO,
               p.NOME, p.RUC, p.CELULAR, p.TELEFONE, p.EMAIL
        FROM ven_venda v
        LEFT JOIN bs_pessoa p ON p.ID_PESSOA = v.ID_PESSOA
        WHERE v.CD_VENDA = %s
        """,
        (numero_ticket,),
    )
    if not ventas:
        return None
    v = ventas[0]

    items = await _fetch(
        """
        SELECT iv.ID_PRODUTO, pr.DS_PRODUTO, iv.QUANTIDADE, iv.VL_PRECO_VENDA, iv.VL_TOTAL
        FROM ven_item_venda iv
        JOIN est_produto pr ON pr.ID_PRODUTO = iv.ID_PRODUTO
        WHERE iv.ID_VENDA = %s AND iv.BO_DEVOLVIDO = 0
        """,
        (v["ID_VENDA"],),
    )

    return {
        "numero_ticket": str(v["CD_VENDA"]),
        "fecha": v["DT_VENDA"].isoformat(),
        "monto_total": float(v["VL_TOTAL"]),
        "cancelado": bool(v["BO_CANCELADO"]),
        "cliente": {
            "documento": v["RUC"],
            "nombre": v["NOME"],
            "telefono": v["CELULAR"] or v["TELEFONE"],
            "email": v["EMAIL"],
        },
        "productos": [
            {
                "id_producto": p["ID_PRODUTO"],
                "descripcion": p["DS_PRODUTO"],
                "cantidad": float(p["QUANTIDADE"]),
                "precio_unitario": float(p["VL_PRECO_VENDA"]),
                "subtotal": float(p["VL_TOTAL"]),
            }
            for p in items
        ],
    }
