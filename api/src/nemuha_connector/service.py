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
        Categoría real por movimiento según qué FK trae poblada bc_operacao_banco
        (verificado contra datos reales, 8167 movimientos confirmados):
        deposito_caja (6039, vía ID_FECHAMENTO_CAIXA_CHICA), pago_cheque (368,
        vía ID_PAGAMENTO_COM_CHEQUE — contraparte resuelta contra bs_pessoa),
        transferencia_interna (206, vía ID_TRANSFERENCIA_CONTA), retiro (539,
        vía ID_RETIRADA), ingreso_caja (8, vía ID_ENTRADA_CAIXA), otro (el resto).
    - fin_gasto                     -> petty_cash.Expense (esto SÍ es caja chica:
        gastos menores pagados en efectivo — fletes, limpieza, reposición)
    - fin_fechamento_caixa_chica    -> finance_agent.FinanceRecommendation
        (tipo="arqueo_caja") cuando VL_DIFERENCA_* != 0 — el legacy ya calcula
        el sobrante/faltante de cada cierre, solo hay que sacarlo a la luz.
        OJO: pese al nombre "caixa_chica" en el legacy, esto NO es caja chica —
        es el cierre de la caja registradora real del POS (fin_caixa, la tabla
        que debería ser "la caja principal", casi no se usa: 2 filas en total).
        Cada una de las 116.392 ventas está vinculada a un cierre de estos vía
        ven_venda.ID_CAIXA_CHICA — es el arqueo de caja real del negocio.
    - fin_fechamento_caixa_chica -> finance_agent.FinanceRecommendation
        (tipo="deposito_pendiente") cuando un cierre con efectivo contado no
        tiene NINGÚN movimiento bancario vinculado (sync_cash_deposit_gaps) —
        conciliación caja->banco, el paso del tesorero que antes no se controlaba.
    - bs_moeda: 1=PYG, 2=USD, 3=BRL — tabla de 3 filas, verificada, estable.
    - ven_venda + ven_item_venda + est_produto -> consulta de ticket para
        IntelliZapp (get_ticket_detail). Lookup puntual en vivo, sin sync/caché.
        CD_VENDA = número de venta interno (verificado único: 116392 filas,
        116392 distintos) — NO confundir con NR_FATURA, que es el número fiscal.
    - ven_venda + ven_item_venda + est_produto -> sales.Sale / sales.SaleItem /
        products.Product (sync_sales). IVA incluido en el precio (estándar POS
        Paraguay) — iva_monto retrocalculado desde el total del ítem. Tasas
        reales verificadas: 0% (7 ítems, exento), 5% (145.669), 10% (510.826).
        condicion="credito" cuando ID_CONTA_RECEBER está poblado (5.451/116.889
        ventas no canceladas — coincide con lo ya sincronizado en accounts_receivable).
    - view_estoque_catalogo -> inventory.Warehouse / inventory.Stock (sync_stock).
        Vista del legacy con la cantidad ACTUAL real por producto y filial
        (qtdAtual) — no hace falta recalcular desde movimientos. Verificado:
        10.761 filas, una sola filial (idFilial=1). stock_minimo real también
        se sincroniza (est_produto.QTD_MINIMA_EM_ESTOQUE) en _resolve_producto.
    - bs_pessoa.VL_LIMITE_CREDITO -> credit_accounts.CreditAccount (sync_credit_accounts).
        469 de 4.699 personas reales tienen límite > 0 (verificado). saldo_utilizado
        se calcula desde accounts_receivable ya sincronizada, no desde el legacy.

Deliberadamente FUERA de esta versión:
    - fin_pagamento / fin_recebimento (detalle de pagos y cobros) — se usa por
      ahora solo el saldo pendiente ya calculado en la cabecera (VL_APAGAR / VL_ARECEBER)
    - con_nota_faturada (fiscal/SIFEN) — pendiente, se diseña junto al módulo sifen
    - bc_pagamento_com_cheque: no se sincroniza como entidad propia — su efecto
      ya se ve reflejado en bc_operacao_banco (categoria="pago_cheque") con la
      contraparte resuelta. No se trackean números de cheque individuales
      porque el legacy tampoco los guarda (confirmado: sin columna NR_CHEQUE
      en ninguna tabla relacionada).

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
from api.src.purchases.models import Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem
from api.src.customers.models import Customer
from api.src.financial.models import SupplierInvoice, BankAccount, BankTransaction
from api.src.petty_cash.models import Expense, ExpenseCategory
from api.src.finance_agent.models import FinanceAgentRun, FinanceRecommendation
from api.src.products.models import Product
from api.src.sales.models import Sale, SaleItem, SalePayment
from api.src.inventory.models import Warehouse, Stock
from api.src.credit_accounts.models import CreditAccount
from api.src.caja.models import CashRegister, CashSession, CashCount

MONEDA_MAP = {1: "PYG", 2: "USD", 3: "BRL"}  # bs_moeda — verificado contra datos reales
SYSTEM_RUN_MODEL = "system:nemuha-controles-automaticos"


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


# ── Resolución de productos (est_produto) ───────────────────────────────────────
#
# UNIDADE_MEDIDA real: solo 2 valores en toda la base — UNIDAD (10463 productos)
# y KILOGRAMOS (489) — verificado contra datos reales, no asumido.
UNIDAD_MEDIDA_MAP = {"UNIDAD": "UN", "KILOGRAMOS": "KG"}


async def _resolve_producto(db: AsyncSession, company_id: str, id_produto: int, codigo_barra: str | None, iva_tasa: Decimal) -> UUID:
    existing = await _get_mapped_target(db, company_id, "est_produto", id_produto)
    if existing:
        return existing

    rows = await _fetch("SELECT ID_PRODUTO, DS_PRODUTO, UNIDADE_MEDIDA, QTD_MINIMA_EM_ESTOQUE FROM est_produto WHERE ID_PRODUTO = %s", (id_produto,))
    nombre = rows[0]["DS_PRODUTO"] if rows else f"Producto legacy #{id_produto}"
    unidad_medida = UNIDAD_MEDIDA_MAP.get(rows[0]["UNIDADE_MEDIDA"], "UN") if rows else "UN"
    stock_minimo = int(rows[0]["QTD_MINIMA_EM_ESTOQUE"] or 0) if rows else 0

    product = Product(
        company_id=company_id,
        sku=str(id_produto),
        codigo_barra=codigo_barra or None,
        nombre=nombre,
        iva_tasa=iva_tasa,
        unidad_medida=unidad_medida,
        stock_minimo=stock_minimo,
    )
    db.add(product)
    await db.flush()
    await _save_map(db, company_id, "est_produto", id_produto, "products", product.id)
    return product.id


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

    # Proveedor real por cada pago con cheque — vía bc_item_pagamento_com_cheque ->
    # fin_conta_pagar -> bs_pessoa. Un mismo cheque puede saldar varias facturas del
    # mismo proveedor; nos alcanza con el primero para identificar la contraparte.
    proveedor_por_cheque_rows = await _fetch("""
        SELECT ip.ID_PAGAMENTO_COM_CHEQUE, p.NOME
        FROM bc_item_pagamento_com_cheque ip
        JOIN fin_conta_pagar cp ON cp.ID_CONTA_PAGAR = ip.ID_CONTA_PAGAR
        JOIN bs_pessoa p ON p.ID_PESSOA = cp.ID_PESSOA
        GROUP BY ip.ID_PAGAMENTO_COM_CHEQUE
    """)
    proveedor_por_cheque = {r["ID_PAGAMENTO_COM_CHEQUE"]: r["NOME"] for r in proveedor_por_cheque_rows}

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

        # Categoría real según qué FK trae poblada bc_operacao_banco — verificado
        # contra datos reales: 74% de los movimientos (6039/8167) enlazan a un
        # cierre de caja puntual vía ID_FECHAMENTO_CAIXA_CHICA.
        categoria = "otro"
        descripcion = r["OBSERVACAO"]
        contraparte = None
        if r.get("ID_FECHAMENTO_CAIXA_CHICA") is not None:
            categoria = "deposito_caja"
            descripcion = descripcion or f"Depósito de cierre de caja del {r['DT_OPERACAO']}"
        elif r.get("ID_PAGAMENTO_COM_CHEQUE") is not None:
            categoria = "pago_cheque"
            contraparte = proveedor_por_cheque.get(r["ID_PAGAMENTO_COM_CHEQUE"])
            descripcion = descripcion or "Pago a proveedor por cheque"
        elif r.get("ID_TRANSFERENCIA_CONTA") is not None:
            categoria = "transferencia_interna"
            descripcion = descripcion or "Transferencia entre cuentas propias"
        elif r.get("ID_RETIRADA") is not None:
            categoria = "retiro"
            descripcion = descripcion or "Retiro de efectivo"
        elif r.get("ID_ENTRADA_CAIXA") is not None:
            categoria = "ingreso_caja"
            descripcion = descripcion or "Ingreso de caja"

        txn = BankTransaction(
            company_id=company_id,
            bank_account_id=bank_account_id,
            fecha=r["DT_OPERACAO"],
            tipo=tipo,
            monto=Decimal(str(r["VL_DOCUMENTO"])),
            moneda=moneda_por_conta.get(r["ID_CONTA"], "PYG"),
            descripcion=descripcion,
            referencia=r["NR_DOCUMENTO"],
            contraparte=contraparte,
            categoria=categoria,
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


# ── Gastos menores (fin_gasto, sí es caja chica de verdad) y arqueo de caja
# (fin_fechamento_caixa_chica — esto NO es caja chica, es el cierre de la caja
# registradora real: fin_caixa casi no se usa (2 filas en toda la base), es
# fin_caixa_chica la que de hecho opera como caja del POS — cada una de las
# 116.392 ventas está vinculada a un cierre vía ven_venda.ID_CAIXA_CHICA) ──

async def sync_expense_categories(db: AsyncSession, company_id: str, since: date | None) -> int:
    rows = await _fetch("SELECT * FROM fin_classificacao_gasto")

    count = 0
    for r in rows:
        existing_id = await _get_mapped_target(db, company_id, "fin_classificacao_gasto", r["ID_CLASSIFICACAO_GASTO"])
        if existing_id:
            count += 1
            continue

        category = ExpenseCategory(
            company_id=company_id,
            nombre=r["DS_CLASSIFICACAO_GASTO"],
            activo=bool(r["BO_ATIVO"]),
        )
        db.add(category)
        await db.flush()
        await _save_map(db, company_id, "fin_classificacao_gasto", r["ID_CLASSIFICACAO_GASTO"], "expense_categories", category.id)
        count += 1

    return count


async def sync_petty_cash_expenses(db: AsyncSession, company_id: str, since: date | None) -> int:
    # centro de costo (fin_centro_de_custo) es una dimension real distinta de la
    # clasificacion de gasto (fin_classificacao_gasto -> expense_categories) —
    # no hay un modelo propio para "centro de costo" en InteliMarket todavia,
    # se anota en notas para no perder el dato en vez de inventar un esquema nuevo.
    centros_costo = {r["ID_CENTRO_CUSTO"]: r["DS_CENTRO_CUSTO"] for r in await _fetch("SELECT ID_CENTRO_CUSTO, DS_CENTRO_CUSTO FROM fin_centro_de_custo")}

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

        category_id = await _get_mapped_target(db, company_id, "fin_classificacao_gasto", r["ID_CLASSIFICACAO_GASTO"])

        # Sin comprobante fiscal asociado -> queda en revisión (no autoaprobado),
        # usando el mismo campo "notas" que ya usa el módulo, sin inventar columnas.
        sin_comprobante = r["ID_NOTA_FISCAL"] is None and not r["NR_DOCUMENTO"]
        notas_partes = []
        if sin_comprobante:
            notas_partes.append("Sin comprobante fiscal en el sistema legacy — requiere revisión")
        centro = centros_costo.get(r["ID_CENTRO_CUSTO"])
        if centro:
            notas_partes.append(f"Centro de costo: {centro}")
        notas = " | ".join(notas_partes) if notas_partes else None

        expense = Expense(
            company_id=company_id,
            category_id=category_id,
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
    run = FinanceAgentRun(company_id=company_id, model=SYSTEM_RUN_MODEL, status="completed", diagnostico="Controles automáticos del sistema (arqueo de caja, depósitos bancarios)")
    db.add(run)
    await db.flush()
    return run


async def sync_cash_register_arqueo(db: AsyncSession, company_id: str, since: date | None) -> int:
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
            tipo="arqueo_caja",
            titulo=f"Diferencia en arqueo de caja del {r['DT_FECHAMENTO']}",
            descripcion=(
                f"El cierre de caja registrado por {r['USUARIO']} el {r['DT_FECHAMENTO']} "
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


# ── Conciliación caja -> banco: cierres con efectivo contado pero sin ningún
# depósito bancario enlazado (vía ID_FECHAMENTO_CAIXA_CHICA en bc_operacao_banco).
# Esto es el paso del tesorero que hoy no tiene ningún control: cuánto se contó
# en caja vs. cuánto efectivamente llegó al banco. No exige que el monto calce
# exacto (un depósito puede consolidar varios cierres) — solo flagea cierres que
# no tienen NINGÚN depósito vinculado, que es la señal más clara de un problema.
async def sync_cash_deposit_gaps(db: AsyncSession, company_id: str, since: date | None) -> int:
    sql = """
        SELECT f.ID_FECHAMENTO_CAIXA_CHICA, f.DT_FECHAMENTO, f.USUARIO, f.VL_FECHAMENTO_GUARANI
        FROM fin_fechamento_caixa_chica f
        LEFT JOIN bc_operacao_banco o
          ON o.ID_FECHAMENTO_CAIXA_CHICA = f.ID_FECHAMENTO_CAIXA_CHICA
          AND (o.BO_CANCELADO IS NULL OR o.BO_CANCELADO = 0)
        WHERE (f.BO_CANCELADO IS NULL OR f.BO_CANCELADO = 0)
          AND f.VL_FECHAMENTO_GUARANI > 0
        GROUP BY f.ID_FECHAMENTO_CAIXA_CHICA
        HAVING COUNT(o.ID_OPERACAO) = 0
    """
    rows = await _fetch(sql)
    # since se filtra en Python, no en SQL — la cláusula ya tiene GROUP BY/HAVING
    # y agregar un AND ahí complicaría la query sin necesidad real.
    if since:
        rows = [r for r in rows if r["DT_FECHAMENTO"].date() >= since]

    count = 0
    system_run = None
    for r in rows:
        existing_id = await _get_mapped_target(db, company_id, "fin_fechamento_caixa_chica:deposito", r["ID_FECHAMENTO_CAIXA_CHICA"])
        if existing_id:
            continue

        if system_run is None:
            system_run = await _get_or_create_system_run(db, company_id)

        monto = Decimal(str(r["VL_FECHAMENTO_GUARANI"]))
        rec = FinanceRecommendation(
            company_id=company_id,
            run_id=system_run.id,
            tipo="deposito_pendiente",
            titulo=f"Cierre de caja del {r['DT_FECHAMENTO']} sin depósito bancario registrado",
            descripcion=(
                f"El cierre de caja registrado por {r['USUARIO']} el {r['DT_FECHAMENTO']} "
                f"contó {monto:,.2f} PYG en efectivo, pero no hay ningún movimiento bancario "
                f"vinculado a ese cierre. Verificar si el efectivo fue depositado bajo otro "
                f"cierre consolidado, o si sigue pendiente de depositar."
            ),
            entidad_relacionada=r["USUARIO"],
            monto_relacionado=f"{monto:,.2f} PYG",
        )
        db.add(rec)
        await db.flush()
        await _save_map(db, company_id, "fin_fechamento_caixa_chica:deposito", r["ID_FECHAMENTO_CAIXA_CHICA"], "finance_recommendations", rec.id)
        count += 1

    return count


# ── Ventas (ven_venda + ven_item_venda) ─────────────────────────────────────────
#
# IVA incluido en el precio (estándar POS Paraguay) — se retrocalcula:
# iva_monto = total - total / (1 + tasa/100). Tasas reales verificadas en
# ven_item_venda.IVA: 0 (7 casos, exento), 5% (145.669 casos), 10% (510.826 casos).
# condicion="credito" cuando ID_CONTA_RECEBER está poblado (5.451 casos sobre
# 116.889 ventas no canceladas — coincide con lo ya sincronizado en accounts_receivable).
# numero_ticket = CD_VENDA (verificado único), NO el número fiscal NR_FATURA.

def _iva_monto(total: Decimal, tasa: Decimal) -> Decimal:
    if tasa == 0:
        return Decimal("0")
    return total - (total / (Decimal("1") + tasa / Decimal("100")))


async def sync_sales(db: AsyncSession, company_id: str, since: date | None) -> int:
    # /sales/{id}/items no trae join con products — se guarda el nombre real acá
    # mismo en descripcion para que el frontend no caiga a un fallback genérico.
    nombre_por_producto = {r["ID_PRODUTO"]: r["DS_PRODUTO"] for r in await _fetch("SELECT ID_PRODUTO, DS_PRODUTO FROM est_produto")}

    sql = "SELECT * FROM ven_venda WHERE 1=1"
    params: tuple = ()
    if since:
        sql += " AND DT_VENDA >= %s"
        params = (since,)
    ventas = await _fetch(sql, params)

    count = 0
    for v in ventas:
        existing_id = await _get_mapped_target(db, company_id, "ven_venda", v["ID_VENDA"])
        if existing_id:
            count += 1
            continue

        customer_id = await _resolve_pessoa(db, company_id, v["ID_PESSOA"], "customer")

        items_rows = await _fetch(
            "SELECT * FROM ven_item_venda WHERE ID_VENDA = %s AND BO_DEVOLVIDO = 0",
            (v["ID_VENDA"],),
        )

        subtotal = Decimal("0")
        base_10 = base_5 = base_exenta = Decimal("0")
        iva_10 = iva_5 = Decimal("0")
        sale_items = []
        for it in items_rows:
            tasa = Decimal(str(it["IVA"]))
            total_item = Decimal(str(it["VL_TOTAL"]))
            iva_monto = _iva_monto(total_item, tasa)
            base = total_item - iva_monto

            if tasa == 10:
                base_10 += base
                iva_10 += iva_monto
            elif tasa == 5:
                base_5 += base
                iva_5 += iva_monto
            else:
                base_exenta += total_item

            subtotal += base

            product_id = await _resolve_producto(db, company_id, it["ID_PRODUTO"], it["CODIGO_BARRA"], tasa)
            sale_items.append(SaleItem(
                product_id=product_id,
                descripcion=nombre_por_producto.get(it["ID_PRODUTO"]),
                cantidad=Decimal(str(it["QUANTIDADE"])),
                precio_unitario=Decimal(str(it["VL_PRECO_VENDA"])),
                descuento_monto=Decimal(str(it["VL_DESCONTO"] or 0)),
                iva_tasa=tasa,
                iva_monto=iva_monto,
                total=total_item,
                costo_unitario=Decimal(str(it["VL_CUSTO_MOEDA_BASE"])) if it["VL_CUSTO_MOEDA_BASE"] is not None else None,
            ))

        cancelado = bool(v["BO_CANCELADO"])
        facturado = bool(v["BO_FATURADO"])
        recibido = bool(v["BO_RECEBIDO"])
        total = Decimal(str(v["VL_TOTAL"]))

        sale = Sale(
            company_id=company_id,
            customer_id=customer_id,
            numero=str(v["CD_VENDA"]),
            fecha=v["DT_VENDA"],
            tipo_comprobante="factura" if facturado else "ticket",
            condicion="credito" if v["ID_CONTA_RECEBER"] is not None else "contado",
            moneda="PYG",
            estado="cancelado" if cancelado else "confirmado",  # valores reales usados por sales/service.py — no "cancelada"/"completada"
            subtotal=subtotal,
            descuento_total=Decimal(str(v["VL_DESCONTO"] or 0)),
            base_gravada_10=base_10,
            base_gravada_5=base_5,
            base_exenta=base_exenta,
            iva_10=iva_10,
            iva_5=iva_5,
            total=total,
            total_pagado=total if recibido else Decimal("0"),
            saldo=Decimal("0") if recibido else total,
        )
        sale.items = sale_items
        db.add(sale)
        await db.flush()
        await _save_map(db, company_id, "ven_venda", v["ID_VENDA"], "sales", sale.id)
        count += 1

    return count


# ── Medios de pago (fin_recebimento + fin_forma_recebimento) ───────────────────
#
# fin_operacao_pos tiene el detalle de marca de tarjeta pero datos corruptos
# (montos con digitos de mas en varias filas de MASTERCARD DEBIT). fin_recebimento
# es la fuente confiable: recibos reales de cobro de venta, con ID_FORMA_RECEBIMENTO
# resuelto contra el catalogo fin_forma_recebimento (EFECTIVO, TARJETA CREDITO,
# TARJETA DEBITO, QR CODE, PIX, TRANF. BANCARIA, CHEQUES, etc.). Usa VL_RECEBIDO
# (VL_RECEBIMENTO viene NULL en la mayoria de las filas).

async def sync_sale_payments(db: AsyncSession, company_id: str, since: date | None) -> int:
    sql = """
        SELECT r.ID_RECEBIMENTO, r.ID_VENDA, r.VL_RECEBIDO, r.DT_RECEBIMENTO,
               COALESCE(f.DS_FORMA_RECEBIMENTO, 'DESCONOCIDO') AS forma_pago
        FROM fin_recebimento r
        LEFT JOIN fin_forma_recebimento f ON f.ID_FORMA_RECEBIMENTO = r.ID_FORMA_RECEBIMENTO
        WHERE r.ID_VENDA IS NOT NULL
    """
    params: tuple = ()
    if since:
        sql += " AND r.DT_RECEBIMENTO >= %s"
        params = (since,)
    recibos = await _fetch(sql, params)

    count = 0
    for r in recibos:
        existing_id = await _get_mapped_target(db, company_id, "fin_recebimento", r["ID_RECEBIMENTO"])
        if existing_id:
            count += 1
            continue

        sale_id = await _get_mapped_target(db, company_id, "ven_venda", r["ID_VENDA"])
        if not sale_id:
            continue

        payment = SalePayment(
            company_id=company_id,
            sale_id=sale_id,
            forma_pago=r["forma_pago"].strip(),
            monto=Decimal(str(r["VL_RECEBIDO"])),
            fecha=r["DT_RECEBIMENTO"],
        )
        db.add(payment)
        await db.flush()
        await _save_map(db, company_id, "fin_recebimento", r["ID_RECEBIMENTO"], "sale_payments", payment.id)
        count += 1

    return count


# ── Stock (view_estoque_catalogo) ───────────────────────────────────────────────
#
# view_estoque_catalogo es una vista del legacy que ya trae la cantidad ACTUAL
# real por producto y filial (qtdAtual) — no hace falta recalcular desde
# movimientos. Verificado: 10.761 filas, una sola filial (idFilial=1).
# Stock.cantidad es Integer en el modelo — las cantidades fraccionarias de
# productos por KG se redondean al sincronizar (limitación del schema actual,
# no de este conector).

async def _resolve_deposito(db: AsyncSession, company_id: str, id_filial: int) -> UUID:
    existing = await _get_mapped_target(db, company_id, "bs_filial:warehouse", id_filial)
    if existing:
        return existing

    warehouse = Warehouse(
        company_id=company_id,
        codigo=str(id_filial),
        nombre=f"Depósito principal (filial {id_filial})",
        tipo="principal",
    )
    db.add(warehouse)
    await db.flush()
    await _save_map(db, company_id, "bs_filial:warehouse", id_filial, "warehouses", warehouse.id)
    return warehouse.id


async def sync_stock(db: AsyncSession, company_id: str, since: date | None) -> int:
    rows = await _fetch("SELECT * FROM view_estoque_catalogo WHERE produtoAtivo = 1")

    count = 0
    warehouse_cache: dict[int, UUID] = {}
    for r in rows:
        id_filial = r["idFilial"]
        if id_filial not in warehouse_cache:
            warehouse_cache[id_filial] = await _resolve_deposito(db, company_id, id_filial)
        warehouse_id = warehouse_cache[id_filial]

        tasa_iva = Decimal("10")  # no crítico para stock — placeholder si hay que crear el producto acá
        product_id = await _resolve_producto(db, company_id, r["idProduto"], r["codigoBarra"], tasa_iva)

        result = await db.execute(
            select(Stock).where(Stock.warehouse_id == warehouse_id, Stock.product_id == product_id)
        )
        stock = result.scalar_one_or_none()
        cantidad = round(Decimal(str(r["qtdAtual"])))
        costo = Decimal(str(r["vlCustoMedioGs"] or 0))

        if stock:
            stock.cantidad = cantidad
            stock.costo_unitario = costo
        else:
            db.add(Stock(warehouse_id=warehouse_id, product_id=product_id, cantidad=cantidad, costo_unitario=costo))

        count += 1

    await db.flush()
    return count


# ── Líneas de crédito (bs_pessoa.VL_LIMITE_CREDITO) ─────────────────────────────
#
# 469 de 4.699 personas reales tienen un límite de crédito > 0 (verificado).
# saldo_utilizado se calcula desde accounts_receivable (ya sincronizada), no
# desde el legacy — es la misma fuente de verdad que usa el resto del sistema.
# VL_LIMITE_CREDITO = 1 es un valor centinela del legado (35 casos verificados):
# "tiene crédito habilitado" sin límite numérico real configurado — no un
# límite de 1 guaraní. Sincronizarlo tal cual generaba "disponible" negativo
# absurdo (deuda real sin límite real para compararla). Se excluyen: su deuda
# real ya queda registrada en accounts_receivable, solo no se les arma una
# línea de crédito formal con un límite inventado.

async def sync_credit_accounts(db: AsyncSession, company_id: str, since: date | None) -> int:
    rows = await _fetch("SELECT ID_PESSOA, VL_LIMITE_CREDITO FROM bs_pessoa WHERE VL_LIMITE_CREDITO > 1")

    count = 0
    for r in rows:
        customer_id = await _resolve_pessoa(db, company_id, r["ID_PESSOA"], "customer")
        limite = Decimal(str(r["VL_LIMITE_CREDITO"]))

        saldo_result = await db.execute(
            text("""
                SELECT COALESCE(SUM(saldo_pendiente), 0) FROM accounts_receivable
                WHERE company_id = :company_id AND customer_id = :customer_id AND estado = 'pendiente'
            """),
            {"company_id": company_id, "customer_id": str(customer_id)},
        )
        saldo_utilizado = Decimal(str(saldo_result.scalar() or "0"))

        result = await db.execute(
            select(CreditAccount).where(CreditAccount.company_id == company_id, CreditAccount.customer_id == customer_id)
        )
        cuenta = result.scalar_one_or_none()
        if cuenta:
            cuenta.limite_credito = limite
            cuenta.saldo_utilizado = saldo_utilizado
            cuenta.saldo_disponible = limite - saldo_utilizado
        else:
            db.add(CreditAccount(
                company_id=company_id,
                customer_id=customer_id,
                limite_credito=limite,
                saldo_utilizado=saldo_utilizado,
                saldo_disponible=limite - saldo_utilizado,
            ))

        count += 1

    await db.flush()
    return count


# ── Saldos de proveedor (fin_saldo_fornecedor) — control cruzado ───────────────
#
# Solo 35 filas reales: no es una fuente primaria, es un saldo que el legado
# mantenía aparte para conciliar contra las cuentas por pagar calculadas.
# Se guarda en Supplier.notas como control cruzado en vez de crear una tabla
# de saldo propia — con 35 filas no se justifica un modelo nuevo.

async def sync_supplier_balances(db: AsyncSession, company_id: str, since: date | None) -> int:
    rows = await _fetch("SELECT * FROM fin_saldo_fornecedor WHERE VL_SALDO != 0")

    count = 0
    for r in rows:
        supplier_id = await _resolve_pessoa(db, company_id, r["ID_PESSOA"], "supplier")
        moneda = MONEDA_MAP.get(r["ID_MOEDA"], "PYG")
        saldo = Decimal(str(r["VL_SALDO"]))

        result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
        supplier = result.scalar_one()
        nota = f"Saldo legado ({moneda}): {saldo}"
        if supplier.notas and "Saldo legado" not in supplier.notas:
            supplier.notas = f"{supplier.notas} | {nota}"
        else:
            supplier.notas = nota
        count += 1

    await db.flush()
    return count


# ── Órdenes de Compra y Recepciones (est_ordem_compra / est_recepcao_ordem_compra) ──
#
# El reporte más usado del negocio (RelatorioOrdemCompra, 9.099 corridas) sale de
# esta area — verificado contra aud_relatorio del propio legado.
# No hay flag "enviado" real en est_ordem_compra: los únicos booleanos son
# BO_CANCELADO/BO_CONFIRMADO/BO_FINALIZADO. "parcial" se infiere si algún item
# tiene QTD_PRODUTO_ENTREGUE > 0 sin estar finalizada la orden.

async def sync_purchase_orders(db: AsyncSession, company_id: str, since: date | None) -> int:
    nombre_por_producto = {r["ID_PRODUTO"]: r["DS_PRODUTO"] for r in await _fetch("SELECT ID_PRODUTO, DS_PRODUTO FROM est_produto")}

    sql = "SELECT * FROM est_ordem_compra WHERE 1=1"
    params: tuple = ()
    if since:
        sql += " AND DT_ORDEM_COMPRA >= %s"
        params = (since,)
    ordenes = await _fetch(sql, params)

    count = 0
    for o in ordenes:
        existing_id = await _get_mapped_target(db, company_id, "est_ordem_compra", o["ID_ORDEM_COMPRA"])
        if existing_id:
            count += 1
            continue

        if o["ID_PESSOA"] is None:
            # 2 de 4.193 órdenes reales sin proveedor asociado en el legado — se saltan.
            continue

        supplier_id = await _resolve_pessoa(db, company_id, o["ID_PESSOA"], "supplier")

        items_rows = await _fetch(
            "SELECT * FROM est_item_ordem_compra WHERE ID_ORDEM_COMPRA = %s",
            (o["ID_ORDEM_COMPRA"],),
        )

        cancelado = bool(o["BO_CANCELADO"])
        finalizado = bool(o["BO_FINALIZADO"])
        confirmado = bool(o["BO_CONFIRMADO"])
        algo_entregado = any((it["QTD_PRODUTO_ENTREGUE"] or 0) > 0 for it in items_rows)

        if cancelado:
            estado = "cancelado"
        elif finalizado:
            estado = "completado"
        elif algo_entregado:
            estado = "parcial"
        elif confirmado:
            estado = "confirmado"
        else:
            estado = "borrador"

        subtotal = Decimal("0")
        iva_10 = iva_5 = Decimal("0")
        order_items = []
        for it in items_rows:
            tasa = Decimal(str(it["IVA"])) if it["IVA"] is not None else Decimal("10")
            total_item = Decimal(str(it["VL_TOTAL"] or 0))
            iva_monto = _iva_monto(total_item, tasa)
            base = total_item - iva_monto
            if tasa == 10:
                iva_10 += iva_monto
            elif tasa == 5:
                iva_5 += iva_monto
            subtotal += base

            product_id = await _resolve_producto(db, company_id, it["ID_PRODUTO"], it["CODIGO_BARRA"], tasa)
            order_items.append(PurchaseOrderItem(
                product_id=product_id,
                descripcion=nombre_por_producto.get(it["ID_PRODUTO"]),
                cantidad=Decimal(str(it["QTD_PRODUTO"] or 0)),
                cantidad_recibida=Decimal(str(it["QTD_PRODUTO_ENTREGUE"] or 0)),
                precio_unitario=Decimal(str(it["VL_UNITARIO"] or 0)),
                iva_tasa=tasa,
                total=total_item,
            ))

        order = PurchaseOrder(
            company_id=company_id,
            supplier_id=supplier_id,
            numero=str(o["CD_ORDEM_COMPRA"]),
            fecha=o["DT_ORDEM_COMPRA"] or o["DT_EMISSAO"],
            estado=estado,
            moneda=MONEDA_MAP.get(o["ID_MOEDA"], "PYG"),
            subtotal=subtotal,
            descuento_total=Decimal(str(o["VL_DESCONTO"] or 0)),
            iva_10=iva_10,
            iva_5=iva_5,
            total=Decimal(str(o["VL_DOCUMENTO"] or 0)),
        )
        order.items = order_items
        db.add(order)
        await db.flush()
        await _save_map(db, company_id, "est_ordem_compra", o["ID_ORDEM_COMPRA"], "purchase_orders", order.id)
        count += 1

    return count


async def sync_purchase_receipts(db: AsyncSession, company_id: str, since: date | None) -> int:
    sql = "SELECT * FROM est_recepcao_ordem_compra WHERE 1=1"
    params: tuple = ()
    if since:
        sql += " AND DT_CADASTRO >= %s"
        params = (since,)
    recepciones = await _fetch(sql, params)

    warehouse_id = await _resolve_deposito(db, company_id, 1)

    count = 0
    for r in recepciones:
        existing_id = await _get_mapped_target(db, company_id, "est_recepcao_ordem_compra", r["ID_RECEPCAO_ORDEM_COMPRA"])
        if existing_id:
            count += 1
            continue

        purchase_order_id = await _get_mapped_target(db, company_id, "est_ordem_compra", r["ID_ORDEM_COMPRA"])
        if not purchase_order_id:
            continue

        po_row = await db.execute(
            select(PurchaseOrder.supplier_id).where(PurchaseOrder.id == purchase_order_id)
        )
        supplier_id = po_row.scalar_one()

        items_rows = await _fetch(
            "SELECT * FROM est_item_recepcao_ordem_compra WHERE ID_RECEPCAO_ORDEM_COMPRA = %s",
            (r["ID_RECEPCAO_ORDEM_COMPRA"],),
        )

        receipt_items = []
        for it in items_rows:
            product_id = await _resolve_producto(db, company_id, it["ID_PRODUTO"], None, Decimal("10"))
            receipt_items.append(PurchaseReceiptItem(
                product_id=product_id,
                cantidad_ordenada=Decimal(str(it["QTD_PRODUTO_FATURA"] or it["QTD_RECEBIDA"] or 0)),
                cantidad_recibida=Decimal(str(it["QTD_RECEBIDA"] or 0)),
                precio_unitario=Decimal(str(it["VL_UNITARIO"] or 0)),
                costo_unitario=Decimal(str(it["VL_UNITARIO"] or 0)),
                total=Decimal(str(it["VL_TOTAL"] or 0)),
            ))

        # NR_DOCUMENTO (numero de factura del proveedor) no es único entre proveedores —
        # se guarda como referencia, no como numero interno (que sí debe ser único).
        receipt = PurchaseReceipt(
            company_id=company_id,
            purchase_order_id=purchase_order_id,
            supplier_id=supplier_id,
            warehouse_id=warehouse_id,
            numero=f"REC-{r['ID_RECEPCAO_ORDEM_COMPRA']}",
            fecha=r["DT_CADASTRO"],
            total=Decimal(str(r["VL_RECEPCAO"] or 0)),
            proveedor_ref=r["REMITO"] or r["NR_DOCUMENTO"],
            estado="cancelado" if r["BO_CANCELADO"] else ("completado" if r["BO_FINALIZADO"] else "pendiente"),
            observaciones=f"Factura proveedor: {r['NR_DOCUMENTO']}" if r["NR_DOCUMENTO"] else None,
        )
        receipt.items = receipt_items
        db.add(receipt)
        await db.flush()
        await _save_map(db, company_id, "est_recepcao_ordem_compra", r["ID_RECEPCAO_ORDEM_COMPRA"], "purchase_receipts", receipt.id)
        count += 1

    return count


# ── Cierres de caja de cajeros (fin_caixa_chica) ────────────────────────────────
#
# 2.061 sesiones reales de 39 cajeros distintos (ago 2025 - jul 2026). El
# legado le puso "caixa_chica" (falso amigo pt-es de "caja chica") pero esto
# NO es caja chica (esa es fin_gasto, ya sincronizada aparte como gastos
# menores) — es la sesion real de apertura/cierre de turno del cajero.
# Antes solo se escaneaba esta tabla para generar alertas de diferencia
# (finance_recommendations, sync_cash_register_arqueo); nunca se cargaba
# como sesion real en cash_registers/cash_sessions/cash_counts, el modelo
# que InteliMarket ya tiene para esto y que estaba vacio.
# El legado no distingue caja fisica (terminal POS), solo cajero — se usa
# una unica "Caja Principal" por empresa, igual que el deposito unico.
# STATUS_CAIXA: 'AB' = abierta (20 reales), 'FE' = fechada/cerrada (2.041).

async def sync_cash_sessions(db: AsyncSession, company_id: str, since: date | None) -> int:
    usuarios = {r["id_usuario"]: r["NM_USUARIO"] for r in await _fetch("SELECT id_usuario, NM_USUARIO FROM sys_usuario")}

    sql = "SELECT * FROM fin_caixa_chica WHERE 1=1"
    params: tuple = ()
    if since:
        sql += " AND DT_ABERTURA >= %s"
        params = (since,)
    rows = await _fetch(sql, params)

    register_id = await _get_mapped_target(db, company_id, "cash_register:principal", 1)
    if not register_id:
        register = CashRegister(company_id=company_id, nombre="Caja Principal", codigo="1")
        db.add(register)
        await db.flush()
        await _save_map(db, company_id, "cash_register:principal", 1, "cash_registers", register.id)
        register_id = register.id

    count = 0
    for r in rows:
        existing_id = await _get_mapped_target(db, company_id, "fin_caixa_chica", r["ID_CAIXA_CHICA"])
        if existing_id:
            count += 1
            continue

        cajero = usuarios.get(r["ID_USUARIO"], f"Usuario {r['ID_USUARIO']}")
        estado = "abierta" if r["STATUS_CAIXA"] == "AB" else "cerrada"

        session = CashSession(
            register_id=register_id,
            user_id=uuid.uuid5(uuid.NAMESPACE_DNS, f"nemuha-usuario-{r['ID_USUARIO']}"),
            monto_apertura=Decimal(str(r["VL_ABERTURA_GUARANI"])),
            fecha_apertura=r["DT_ABERTURA"],
            fecha_cierre=r["DT_FECHAMENTO"] if estado == "cerrada" else None,
            monto_cierre=Decimal(str(r["VL_FECHAMENTO_GUARANI"])) if estado == "cerrada" else None,
            estado=estado,
            observaciones=f"Cajero: {cajero}",
        )
        db.add(session)
        await db.flush()

        if estado == "cerrada":
            db.add(CashCount(
                session_id=session.id,
                monto_efectivo=Decimal(str(r["VL_FECHAMENTO_GUARANI"])),
                monto_total=Decimal(str(r["VL_FECHAMENTO_GUARANI"])),
                diferencia=Decimal(str(r["VL_DIFERENCA_GUARANI"])),
            ))

        await _save_map(db, company_id, "fin_caixa_chica", r["ID_CAIXA_CHICA"], "cash_sessions", session.id)
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
        ("expense_categories", sync_expense_categories),
        ("petty_cash_expenses", sync_petty_cash_expenses),
        ("cash_register_arqueo", sync_cash_register_arqueo),
        ("cash_deposit_gaps", sync_cash_deposit_gaps),
        ("sales", sync_sales),
        ("sale_payments", sync_sale_payments),
        ("stock", sync_stock),
        ("credit_accounts", sync_credit_accounts),
        ("supplier_balances", sync_supplier_balances),
        ("purchase_orders", sync_purchase_orders),
        ("purchase_receipts", sync_purchase_receipts),
        ("cash_sessions", sync_cash_sessions),
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
