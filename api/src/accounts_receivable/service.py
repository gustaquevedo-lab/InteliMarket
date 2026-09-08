from __future__ import annotations
from decimal import Decimal
from datetime import datetime, timezone, date, timedelta
import uuid

from sqlalchemy import select, text, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession



async def search_empresas_vinculadas(db: AsyncSession, company_id: str, search: str = "") -> list[str]:
    filter_sql = "AND empresa_vinculada_nombre ILIKE :search" if (search and search.strip()) else ""
    query = f"""
        SELECT DISTINCT trim(empresa_vinculada_nombre) as nombre
        FROM customers
        WHERE company_id = :company_id AND empresa_vinculada_nombre IS NOT NULL AND trim(empresa_vinculada_nombre) <> ''
        {filter_sql}
        ORDER BY nombre LIMIT 50
    """
    params = {"company_id": company_id}
    if search and search.strip():
        params["search"] = f"%{search.strip()}%"
    result = await db.execute(text(query), params)
    return [row.nombre for row in result.all() if row.nombre]


async def get_aging_report(db: AsyncSession, company_id: str) -> dict:
    today = date.today()
    query = text("""
        SELECT
            ar.id,
            ar.customer_id,
            COALESCE(c.razon_social, c.nombre_fantasia, c.ruc, 'Cliente') as customer_name,
            c.ruc as customer_ruc,
            c.telefono as customer_telefono,
            ar.sale_id,
            ar.numero_documento,
            ar.fecha_emision,
            ar.fecha_vencimiento,
            ar.moneda,
            ar.monto_original,
            ar.saldo_pendiente,
            ar.tipo,
            ar.estado,
            CASE
                WHEN ar.fecha_vencimiento IS NULL THEN 0
                ELSE (DATE(:today) - ar.fecha_vencimiento)::int
            END as dias_mora
        FROM accounts_receivable ar
        LEFT JOIN customers c ON c.id = ar.customer_id
        WHERE ar.company_id = :company_id
        AND ar.estado = 'pendiente'
        ORDER BY ar.fecha_vencimiento ASC NULLS LAST
    """)
    result = await db.execute(query, {"company_id": company_id, "today": today})
    rows = result.fetchall()

    total_pendiente = Decimal("0")
    current = Decimal("0")
    days_1_30 = Decimal("0")
    days_31_60 = Decimal("0")
    days_61_90 = Decimal("0")
    days_91_plus = Decimal("0")
    cantidad_total = len(rows)
    customer_aging = {}

    for row in rows:
        saldo = Decimal(str(row.saldo_pendiente))
        total_pendiente += saldo
        dias = row.dias_mora or 0

        if dias <= 0:
            current += saldo
        elif dias <= 30:
            days_1_30 += saldo
        elif dias <= 60:
            days_31_60 += saldo
        elif dias <= 90:
            days_61_90 += saldo
        else:
            days_91_plus += saldo

        cid = str(row.customer_id)
        if cid not in customer_aging:
            customer_aging[cid] = {
                "customer_id": cid,
                "customer_name": row.customer_name or "N/A",
                "customer_ruc": getattr(row, "customer_ruc", None) or "—",
                "customer_telefono": getattr(row, "customer_telefono", None) or "—",
                "saldo_total": Decimal("0"),
                "current": Decimal("0"), "days_1_30": Decimal("0"),
                "days_31_60": Decimal("0"), "days_61_90": Decimal("0"),
                "days_91_plus": Decimal("0"), "total_documentos": 0,
            }
        ca = customer_aging[cid]
        ca["saldo_total"] += saldo
        ca["total_documentos"] += 1
        if dias <= 0:
            ca["current"] += saldo
        elif dias <= 30:
            ca["days_1_30"] += saldo
        elif dias <= 60:
            ca["days_31_60"] += saldo
        elif dias <= 90:
            ca["days_61_90"] += saldo
        else:
            ca["days_91_plus"] += saldo

    total = total_pendiente or Decimal("1")
    buckets = [
        {"rango": "Al dia", "monto": current, "cantidad": sum(1 for r in rows if (r.dias_mora or 0) <= 0), "porcentaje": (current / total * 100).quantize(Decimal("1"))},
        {"rango": "1-30 dias", "monto": days_1_30, "cantidad": sum(1 for r in rows if 1 <= (r.dias_mora or 0) <= 30), "porcentaje": (days_1_30 / total * 100).quantize(Decimal("1"))},
        {"rango": "31-60 dias", "monto": days_31_60, "cantidad": sum(1 for r in rows if 31 <= (r.dias_mora or 0) <= 60), "porcentaje": (days_31_60 / total * 100).quantize(Decimal("1"))},
        {"rango": "61-90 dias", "monto": days_61_90, "cantidad": sum(1 for r in rows if 61 <= (r.dias_mora or 0) <= 90), "porcentaje": (days_61_90 / total * 100).quantize(Decimal("1"))},
        {"rango": "+90 dias", "monto": days_91_plus, "cantidad": sum(1 for r in rows if (r.dias_mora or 0) > 90), "porcentaje": (days_91_plus / total * 100).quantize(Decimal("1"))},
    ]

    return {
        "total_pendiente": total_pendiente,
        "cantidad_documentos": cantidad_total,
        "buckets": buckets,
        "por_clientes": sorted(customer_aging.values(), key=lambda x: x["saldo_total"], reverse=True),
        "fecha": today,
    }


async def get_accounts_receivable(
    db: AsyncSession, company_id: str, customer_id: str | None = None,
    estado: str | None = None, search: str | None = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    today = date.today()
    query = text("""
        SELECT
            ar.id, ar.company_id, ar.customer_id, ar.sale_id, ar.numero_documento,
            ar.fecha_emision, ar.fecha_vencimiento, ar.moneda, ar.monto_original,
            ar.saldo_pendiente, ar.tipo, ar.estado, ar.ultimo_pago, ar.notas_cobranza,
            ar.user_id, ar.created_at, ar.updated_at,
            COALESCE(c.razon_social, c.nombre_fantasia, c.ruc, 'Cliente') as customer_name,
            c.ruc as customer_ruc,
            c.telefono as customer_telefono,
            CASE
                WHEN ar.estado <> 'pendiente' THEN 0
                WHEN ar.fecha_vencimiento IS NULL THEN 0
                ELSE (DATE(:today) - ar.fecha_vencimiento)::int
            END as dias_mora
        FROM accounts_receivable ar
        LEFT JOIN customers c ON c.id = ar.customer_id
        WHERE ar.company_id = :company_id
    """)
    params = {"company_id": company_id, "today": today}
    if customer_id:
        query = text(query.text + " AND ar.customer_id = :customer_id")
        params["customer_id"] = customer_id
    if estado:
        query = text(query.text + " AND ar.estado = :estado")
        params["estado"] = estado
    if search:
        s = f"%{search.strip()}%"
        query = text(query.text + " AND (ar.numero_documento ILIKE :search OR c.razon_social ILIKE :search OR c.nombre_fantasia ILIKE :search OR c.ruc ILIKE :search)")
        params["search"] = s
    # Los documentos pagados nunca cambian su fecha_vencimiento (queda fija en
    # el pasado) — ordenar solo por fecha hacia el frente hacia que, sin filtro
    # de estado, las primeras filas de la pagina sean puro historico ya
    # saldado en vez de la deuda real vigente. Pendientes primero, mas viejos
    # primero dentro de cada grupo (para priorizar la mora mas antigua).
    query = text(query.text + """
        ORDER BY CASE WHEN ar.estado = 'pendiente' THEN 0 ELSE 1 END, ar.fecha_vencimiento ASC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)
    params["limit"] = limit
    params["offset"] = offset

    result = await db.execute(query, params)
    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]


async def count_accounts_receivable(db: AsyncSession, company_id: str, customer_id: str | None = None, estado: str | None = None) -> int:
    query = "SELECT COUNT(*) FROM accounts_receivable ar WHERE ar.company_id = :company_id"
    params = {"company_id": company_id}
    if customer_id:
        query += " AND ar.customer_id = :customer_id"
        params["customer_id"] = customer_id
    if estado:
        query += " AND ar.estado = :estado"
        params["estado"] = estado
    result = await db.execute(text(query), params)
    return result.scalar() or 0


async def create_accounts_receivable_for_sale(
    db: AsyncSession, company_id: str, customer_id: str, sale_id: str,
    total: Decimal, numero: str, fecha_vencimiento: date | None = None,
    tipo: str = "factura",
) -> None:
    if not fecha_vencimiento:
        fecha_vencimiento = date.today() + timedelta(days=30)

    await db.execute(
        text("""
            INSERT INTO accounts_receivable
                (company_id, customer_id, sale_id, numero_documento, fecha_emision,
                 fecha_vencimiento, moneda, monto_original, saldo_pendiente, tipo, estado)
            VALUES
                (:company_id, :customer_id, :sale_id, :numero_documento, NOW(),
                 :fecha_vencimiento, 'PYG', :monto, :monto, :tipo, 'pendiente')
        """),
        {
            "company_id": company_id,
            "customer_id": customer_id,
            "sale_id": sale_id,
            "numero_documento": numero,
            "fecha_vencimiento": fecha_vencimiento,
            "monto": float(total),
            "tipo": tipo,
        }
    )
    await db.flush()


async def apply_payment_to_receivable(
    db: AsyncSession, company_id: str, sale_id: str, monto: Decimal,
) -> dict:
    result = await db.execute(
        text("""
            SELECT id, saldo_pendiente FROM accounts_receivable
            WHERE company_id = :company_id AND sale_id = :sale_id AND estado = 'pendiente'
            ORDER BY fecha_vencimiento ASC
            LIMIT 1
        """),
        {"company_id": company_id, "sale_id": sale_id},
    )
    row = result.fetchone()
    if not row:
        return {"error": "Cuenta por cobrar no encontrada"}

    nuevo_saldo = max(Decimal("0"), Decimal(str(row.saldo_pendiente)) - monto)
    nuevo_estado = "pagado" if nuevo_saldo == 0 else "pendiente"

    await db.execute(
        text("""
            UPDATE accounts_receivable
            SET saldo_pendiente = :saldo, estado = :estado, ultimo_pago = NOW()
            WHERE id = :id
        """),
        {"saldo": float(nuevo_saldo), "estado": nuevo_estado, "id": row.id},
    )
    await db.flush()

    return {
        "receivable_id": str(row.id),
        "saldo_anterior": float(row.saldo_pendiente),
        "monto_aplicado": float(monto),
        "saldo_pendiente": float(nuevo_saldo),
        "estado": nuevo_estado,
    }


async def get_dso(db: AsyncSession, company_id: str, dias: int = 90) -> float | None:
    """Days Sales Outstanding: cuantos dias en promedio tarda la empresa en
    cobrar sus ventas a credito. Formula estandar de la industria:
    DSO = (saldo pendiente total / ventas a credito del periodo) * dias del periodo.
    Usamos sales.condicion='credito' — es el campo real que ya distingue
    ventas a credito de las de contado (5.937 de 122.222 ventas del cliente)."""
    desde = date.today() - timedelta(days=dias)
    ventas_result = await db.execute(
        text("""
            SELECT COALESCE(SUM(total), 0) FROM sales
            WHERE company_id = :company_id AND condicion = 'credito'
            AND estado <> 'anulado' AND fecha >= :desde
        """),
        {"company_id": company_id, "desde": desde},
    )
    ventas_credito = Decimal(str(ventas_result.scalar() or 0))
    if ventas_credito == 0:
        return None

    saldo_result = await db.execute(
        text("SELECT COALESCE(SUM(saldo_pendiente), 0) FROM accounts_receivable WHERE company_id = :company_id AND estado = 'pendiente'"),
        {"company_id": company_id},
    )
    saldo_pendiente = Decimal(str(saldo_result.scalar() or 0))
    return float((saldo_pendiente / ventas_credito) * dias)


async def get_receivable_summary(db: AsyncSession, company_id: str) -> dict:
    today = date.today()
    query = text("""
        SELECT
            COUNT(*) as total,
            COALESCE(SUM(saldo_pendiente), 0) as total_pendiente,
            COALESCE(SUM(CASE WHEN estado = 'pagado' THEN 1 ELSE 0 END), 0) as pagados,
            COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END), 0) as pendientes,
            COALESCE(SUM(CASE WHEN estado = 'pendiente' AND fecha_vencimiento < :today THEN 1 ELSE 0 END), 0) as vencidos,
            COALESCE(SUM(CASE WHEN estado = 'pendiente' AND fecha_vencimiento < :today THEN saldo_pendiente ELSE 0 END), 0) as monto_vencido
        FROM accounts_receivable
        WHERE company_id = :company_id
    """)
    result = await db.execute(query, {"company_id": company_id, "today": today})
    row = result.fetchone()
    summary = dict(row._mapping) if row else {
        "total": 0, "total_pendiente": 0, "pagados": 0,
        "pendientes": 0, "vencidos": 0, "monto_vencido": 0,
    }
    summary["dso"] = await get_dso(db, company_id)
    return summary


# ── Pagos con reparto entre facturas ──────────────────────────────────

async def list_customer_pending_documents(db: AsyncSession, company_id: str, customer_id: str) -> list[dict]:
    """Documentos pendientes de un cliente, para el modal de registrar pago —
    ordenados por vencimiento (mas viejo primero) para facilitar el reparto."""
    result = await db.execute(
        text("""
            SELECT id, numero_documento, fecha_emision, fecha_vencimiento, moneda,
                   monto_original, saldo_pendiente,
                   CASE WHEN fecha_vencimiento IS NULL THEN 0 ELSE (CURRENT_DATE - fecha_vencimiento)::int END as dias_mora
            FROM accounts_receivable
            WHERE company_id = :company_id AND customer_id = :customer_id AND estado = 'pendiente'
            ORDER BY fecha_vencimiento ASC NULLS LAST
        """),
        {"company_id": company_id, "customer_id": customer_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


async def _record_treasury_ingress(
    db: AsyncSession,
    company_id: str,
    payment_id: uuid.UUID,
    customer_id: str,
    customer_name: str,
    customer_ruc: str,
    monto: Decimal,
    data,
    registrado_por: str | None,
    numero_recibo: str,
) -> dict:
    """Registra el impacto del cobro en el subsistema correspondiente de tesorería:
    - Efectivo: genera entrada en VaultEntry (Bóveda Central) o vincula caja_session_id.
    - Transferencia / PIX / QR: genera BankTransaction (tipo='credito') y actualiza bank_account.saldo_actual.
    - Cheque: registra el cheque recibido en cartera (tabla cheques) con sus fechas y emisor."""
    forma_pago = (getattr(data, "forma_pago", None) or "efectivo").lower()
    bank_account_id = getattr(data, "bank_account_id", None)
    caja_session_id = getattr(data, "caja_session_id", None)
    es_bancario = forma_pago in ("transferencia", "deposito_bancario", "deposito", "pix", "qr")
    destino_fondos = getattr(data, "destino_fondos", None) or ("banco" if es_bancario else "boveda")

    vault_entry_id = None
    cheque_id = None
    bank_tx_id = None

    if forma_pago == "efectivo":
        if destino_fondos == "caja" and caja_session_id:
            pass
        else:
            vault_entry_id = uuid.uuid4()
            await db.execute(
                text("""
                    INSERT INTO vault_entries
                        (id, company_id, origen, monto_pyg, estado, observaciones, registrado_por, created_at)
                    VALUES
                        (:id, :company_id, 'cobranza_ar', :monto, 'en_boveda', :obs, :user_id, NOW())
                """),
                {
                    "id": vault_entry_id,
                    "company_id": company_id,
                    "monto": float(monto),
                    "obs": f"Cobro AR Recibo #{numero_recibo} - Cliente: {customer_name}",
                    "user_id": registrado_por,
                },
            )
    elif forma_pago in ("transferencia", "deposito_bancario", "deposito", "pix", "qr"):
        if bank_account_id:
            bank_tx_id = uuid.uuid4()
            desc_tipo = "Depósito Bancario" if "deposito" in forma_pago else ("PIX" if forma_pago == "pix" else ("QR" if forma_pago == "qr" else "Transferencia"))
            ref_str = f" - Boleta/Ref: {getattr(data, 'referencia', '')}" if getattr(data, "referencia", None) else ""
            await db.execute(
                text("""
                    INSERT INTO bank_transactions
                        (id, company_id, bank_account_id, fecha, tipo, monto, moneda, descripcion, referencia, contraparte, conciliado, fecha_conciliacion, categoria, created_at)
                    VALUES
                        (:id, :company_id, :bank_account_id, :fecha, 'credito', :monto, :moneda, :descripcion, :referencia, :contraparte, true, NOW(), 'cobranzas', NOW())
                """),
                {
                    "id": bank_tx_id,
                    "company_id": company_id,
                    "bank_account_id": str(bank_account_id),
                    "fecha": getattr(data, "fecha", None) or date.today(),
                    "monto": float(monto),
                    "moneda": getattr(data, "moneda", "PYG") or "PYG",
                    "descripcion": f"Cobro AR {desc_tipo} Recibo #{numero_recibo}{ref_str} - Cliente: {customer_name}",
                    "referencia": getattr(data, "referencia", None),
                    "contraparte": customer_name,
                },
            )
            await db.execute(
                text("""
                    UPDATE bank_accounts
                    SET saldo_actual = saldo_actual + :monto, updated_at = NOW()
                    WHERE id = :bank_account_id
                """),
                {"monto": float(monto), "bank_account_id": str(bank_account_id)},
            )
    elif forma_pago == "cheque":
        cheque_id = uuid.uuid4()
        chq_f_emision = getattr(data, "cheque_fecha_emision", None) or getattr(data, "fecha", None) or date.today()
        chq_f_cobro = getattr(data, "cheque_fecha_cobro", None) or chq_f_emision
        diferido = bool(chq_f_cobro and chq_f_emision and chq_f_cobro > chq_f_emision)
        await db.execute(
            text("""
                INSERT INTO cheques
                    (id, company_id, numero, banco_emisor, beneficiario, librador_nombre, librador_documento,
                     monto, moneda, fecha_emision, fecha_pago, diferido, estado, tipo_cheque, customer_id,
                     receivable_payment_id, concepto, notas, created_by, created_at, updated_at)
                VALUES
                    (:id, :company_id, :numero, :banco, 'Extra Supermercado Mayorista', :librador, :ruc,
                     :monto, 'PYG', :f_emision, :f_pago, :diferido, 'en_cartera', 'recibido', :cust_id,
                     :payment_id, :concepto, :notas, :user_id, NOW(), NOW())
            """),
            {
                "id": cheque_id,
                "company_id": company_id,
                "numero": getattr(data, "cheque_numero", None) or f"CHQ-{str(payment_id)[:8].upper()}",
                "banco": getattr(data, "cheque_banco", None) or "N/A",
                "librador": getattr(data, "cheque_librador", None) or customer_name,
                "ruc": getattr(data, "cheque_ruc", None) or customer_ruc,
                "monto": float(monto),
                "f_emision": chq_f_emision,
                "f_pago": chq_f_cobro,
                "diferido": diferido,
                "cust_id": customer_id,
                "payment_id": payment_id,
                "concepto": f"Cobro AR Recibo #{numero_recibo}",
                "notas": getattr(data, "observaciones", None),
                "user_id": registrado_por,
            },
        )

    await db.execute(
        text("""
            UPDATE receivable_payments
            SET bank_account_id = :bank_account_id,
                cheque_id = :cheque_id,
                caja_session_id = :caja_session_id,
                vault_entry_id = :vault_entry_id,
                destino_fondos = :destino_fondos
            WHERE id = :payment_id
        """),
        {
            "bank_account_id": str(bank_account_id) if bank_account_id else None,
            "cheque_id": cheque_id,
            "caja_session_id": str(caja_session_id) if caja_session_id else None,
            "vault_entry_id": vault_entry_id,
            "destino_fondos": destino_fondos,
            "payment_id": payment_id,
        },
    )

    return {
        "vault_entry_id": str(vault_entry_id) if vault_entry_id else None,
        "bank_tx_id": str(bank_tx_id) if bank_tx_id else None,
        "cheque_id": str(cheque_id) if cheque_id else None,
    }


async def create_receivable_payment(db: AsyncSession, company_id: str, data, registrado_por: str | None) -> dict:
    """Registra un pago de un cliente y lo reparte entre los documentos que
    indique — a diferencia de apply_payment_to_receivable (atado 1 a 1 a una
    venta), esto permite que un solo pago cubra varias facturas, que es como
    se cobra en la practica. Valida que el reparto sume exactamente el monto
    total del pago y que cada documento tenga saldo suficiente."""
    total_allocado = sum(a.monto for a in data.allocations)
    if total_allocado != data.monto_total:
        return {"error": f"El reparto ({total_allocado}) no coincide con el monto total del pago ({data.monto_total})"}

    ids = [str(a.accounts_receivable_id) for a in data.allocations]
    result = await db.execute(
        text("""
            SELECT id, saldo_pendiente, customer_id FROM accounts_receivable
            WHERE id = ANY(:ids) AND company_id = :company_id
        """),
        {"ids": ids, "company_id": company_id},
    )
    docs = {str(r.id): r for r in result.fetchall()}

    for alloc in data.allocations:
        doc = docs.get(str(alloc.accounts_receivable_id))
        if not doc:
            return {"error": f"Documento {alloc.accounts_receivable_id} no encontrado"}
        if str(doc.customer_id) != str(data.customer_id):
            return {"error": "Todos los documentos deben ser del mismo cliente"}
        if alloc.monto > Decimal(str(doc.saldo_pendiente)):
            return {"error": f"El monto asignado a {alloc.accounts_receivable_id} supera el saldo pendiente de ese documento"}

    # Obtener datos del cliente
    cust_res = await db.execute(
        text("SELECT razon_social, nombre_fantasia, ruc FROM customers WHERE id = :cid"),
        {"cid": str(data.customer_id)},
    )
    cust_row = cust_res.first()
    customer_name = (cust_row.razon_social or cust_row.nombre_fantasia or "Cliente") if cust_row else "Cliente"
    customer_ruc = (cust_row.ruc or "—") if cust_row else "—"

    payment_id = uuid.uuid4()
    numero_recibo = f"REC-{str(payment_id)[:8].upper()}"

    await db.execute(
        text("""
            INSERT INTO receivable_payments
                (id, company_id, customer_id, monto_total, moneda, forma_pago, referencia, fecha, observaciones, registrado_por)
            VALUES (:id, :company_id, :customer_id, :monto_total, :moneda, :forma_pago, :referencia, :fecha, :observaciones, :registrado_por)
        """),
        {
            "id": payment_id, "company_id": company_id, "customer_id": str(data.customer_id),
            "monto_total": float(data.monto_total), "moneda": data.moneda, "forma_pago": data.forma_pago,
            "referencia": data.referencia, "fecha": data.fecha or date.today(),
            "observaciones": data.observaciones, "registrado_por": registrado_por,
        },
    )

    aplicados = []
    for alloc in data.allocations:
        doc = docs[str(alloc.accounts_receivable_id)]
        nuevo_saldo = Decimal(str(doc.saldo_pendiente)) - alloc.monto
        nuevo_estado = "pagado" if nuevo_saldo <= 0 else "pendiente"
        await db.execute(
            text("""
                UPDATE accounts_receivable
                SET saldo_pendiente = :saldo, estado = :estado, ultimo_pago = NOW()
                WHERE id = :id
            """),
            {"saldo": float(max(Decimal("0"), nuevo_saldo)), "estado": nuevo_estado, "id": str(alloc.accounts_receivable_id)},
        )
        await db.execute(
            text("""
                INSERT INTO receivable_payment_allocations (receivable_payment_id, accounts_receivable_id, monto)
                VALUES (:payment_id, :ar_id, :monto)
            """),
            {"payment_id": payment_id, "ar_id": str(alloc.accounts_receivable_id), "monto": float(alloc.monto)},
        )
        aplicados.append({"accounts_receivable_id": str(alloc.accounts_receivable_id), "monto": float(alloc.monto), "nuevo_saldo": float(max(Decimal('0'), nuevo_saldo)), "nuevo_estado": nuevo_estado})

    await db.execute(
        text("""
            UPDATE credit_accounts
            SET saldo_utilizado = GREATEST(0, saldo_utilizado - :monto),
                saldo_disponible = LEAST(limite_credito, saldo_disponible + :monto)
            WHERE company_id = :company_id AND customer_id = :customer_id
        """),
        {"monto": float(data.monto_total), "company_id": company_id, "customer_id": str(data.customer_id)},
    )
    nuevo_saldo_utilizado = await db.execute(
        text("SELECT saldo_utilizado FROM credit_accounts WHERE company_id = :company_id AND customer_id = :customer_id"),
        {"company_id": company_id, "customer_id": str(data.customer_id)},
    )
    row = nuevo_saldo_utilizado.first()
    if row is not None:
        await db.execute(
            text("UPDATE customers SET credito_usado = :monto WHERE id = :customer_id"),
            {"monto": float(row.saldo_utilizado), "customer_id": str(data.customer_id)},
        )

    treasury_res = await _record_treasury_ingress(
        db=db,
        company_id=company_id,
        payment_id=payment_id,
        customer_id=str(data.customer_id),
        customer_name=customer_name,
        customer_ruc=customer_ruc,
        monto=Decimal(str(data.monto_total)),
        data=data,
        registrado_por=registrado_por,
        numero_recibo=numero_recibo,
    )

    await db.flush()
    return {
        "id": str(payment_id),
        "payment_id": str(payment_id),
        "numero_recibo": numero_recibo,
        "monto_total": float(data.monto_total),
        "allocations": aplicados,
        "treasury": treasury_res,
    }



async def list_payments_for_document(db: AsyncSession, accounts_receivable_id: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT rp.id, rp.fecha, rp.forma_pago, rp.referencia, rp.observaciones, rpa.monto, rp.created_at
            FROM receivable_payment_allocations rpa
            JOIN receivable_payments rp ON rp.id = rpa.receivable_payment_id
            WHERE rpa.accounts_receivable_id = :ar_id
            ORDER BY rp.fecha DESC, rp.created_at DESC
        """),
        {"ar_id": accounts_receivable_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


async def list_payments_for_customer(db: AsyncSession, company_id: str, customer_id: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT rp.id, rp.fecha, rp.monto_total, rp.forma_pago, rp.referencia, rp.observaciones, rp.created_at,
                   COALESCE(json_agg(json_build_object('accounts_receivable_id', rpa.accounts_receivable_id, 'numero_documento', ar.numero_documento, 'monto', rpa.monto)) FILTER (WHERE rpa.id IS NOT NULL), '[]') as allocations
            FROM receivable_payments rp
            LEFT JOIN receivable_payment_allocations rpa ON rpa.receivable_payment_id = rp.id
            LEFT JOIN accounts_receivable ar ON ar.id = rpa.accounts_receivable_id
            WHERE rp.company_id = :company_id AND rp.customer_id = :customer_id
            GROUP BY rp.id
            ORDER BY rp.fecha DESC, rp.created_at DESC
        """),
        {"company_id": company_id, "customer_id": customer_id},
    )
    rows = []
    for row in result.fetchall():
        d = dict(row._mapping)
        if isinstance(d["allocations"], str):
            import json as _json
            d["allocations"] = _json.loads(d["allocations"])
        rows.append(d)
    return rows


# ── Reportes (Excel / PDF) ──────────────────────────────────────────────

async def get_aging_for_report(
    db: AsyncSession, company_id: str, fecha_desde: date | None, fecha_hasta: date | None,
    customer_id: str | None = None, empresa_vinculada: str | None = None,
) -> dict:
    """Igual a get_aging_report, pero acota los documentos incluidos por fecha
    de emision (para el reporte exportable con rango de fechas) — la mora se
    sigue calculando contra hoy, es el mismo criterio que ya usa la pantalla.
    customer_id acota a un solo cliente; empresa_vinculada filtra por el
    nombre de la empresa vinculada del cliente (busqueda parcial)."""
    today = date.today()
    query = """
        SELECT
            ar.id, ar.customer_id, c.razon_social as customer_name, ar.sale_id,
            ar.numero_documento, ar.fecha_emision, ar.fecha_vencimiento, ar.moneda,
            ar.monto_original, ar.saldo_pendiente, ar.tipo, ar.estado,
            CASE WHEN ar.fecha_vencimiento IS NULL THEN 0 ELSE (DATE(:today) - ar.fecha_vencimiento)::int END as dias_mora
        FROM accounts_receivable ar
        LEFT JOIN customers c ON c.id = ar.customer_id
        WHERE ar.company_id = :company_id AND ar.estado = 'pendiente'
    """
    params = {"company_id": company_id, "today": today}
    if fecha_desde:
        query += " AND ar.fecha_emision >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        query += " AND ar.fecha_emision <= :fecha_hasta"
        params["fecha_hasta"] = fecha_hasta
    if customer_id:
        query += " AND ar.customer_id = :customer_id"
        params["customer_id"] = customer_id
    if empresa_vinculada:
        query += " AND c.empresa_vinculada_nombre ILIKE :empresa_vinculada"
        params["empresa_vinculada"] = f"%{empresa_vinculada}%"
    query += " ORDER BY ar.fecha_vencimiento ASC NULLS LAST"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    total_pendiente = Decimal("0")
    current = days_1_30 = days_31_60 = days_61_90 = days_91_plus = Decimal("0")
    customer_aging: dict = {}
    for row in rows:
        saldo = Decimal(str(row.saldo_pendiente))
        dias = row.dias_mora or 0
        total_pendiente += saldo
        if dias <= 0:
            current += saldo
        elif dias <= 30:
            days_1_30 += saldo
        elif dias <= 60:
            days_31_60 += saldo
        elif dias <= 90:
            days_61_90 += saldo
        else:
            days_91_plus += saldo

        cid = str(row.customer_id)
        if cid not in customer_aging:
            customer_aging[cid] = {
                "customer_id": cid, "customer_name": row.customer_name or "N/A",
                "saldo_total": Decimal("0"), "current": Decimal("0"), "days_1_30": Decimal("0"),
                "days_31_60": Decimal("0"), "days_61_90": Decimal("0"), "days_91_plus": Decimal("0"),
                "total_documentos": 0,
            }
        ca = customer_aging[cid]
        ca["saldo_total"] += saldo
        ca["total_documentos"] += 1
        if dias <= 0:
            ca["current"] += saldo
        elif dias <= 30:
            ca["days_1_30"] += saldo
        elif dias <= 60:
            ca["days_31_60"] += saldo
        elif dias <= 90:
            ca["days_61_90"] += saldo
        else:
            ca["days_91_plus"] += saldo

    return {
        "fecha_desde": fecha_desde, "fecha_hasta": fecha_hasta,
        "total_pendiente": total_pendiente, "cantidad_documentos": len(rows),
        "current": current, "days_1_30": days_1_30, "days_31_60": days_31_60,
        "days_61_90": days_61_90, "days_91_plus": days_91_plus,
        "por_clientes": sorted(customer_aging.values(), key=lambda x: x["saldo_total"], reverse=True),
        "documentos": [dict(row._mapping) for row in rows],
    }


async def list_payments_period(db: AsyncSession, company_id: str, fecha_desde: date | None, fecha_hasta: date | None) -> list[dict]:
    """Cobranzas del periodo — todos los pagos registrados en AR (con reparto
    entre facturas), no solo de un cliente puntual. Base del reporte de cobranzas."""
    query = """
        SELECT rp.id, rp.fecha, rp.monto_total, rp.moneda, rp.forma_pago, rp.referencia,
               rp.observaciones, rp.created_at, c.razon_social as customer_name,
               COALESCE(json_agg(json_build_object('numero_documento', ar.numero_documento, 'monto', rpa.monto)) FILTER (WHERE rpa.id IS NOT NULL), '[]') as allocations
        FROM receivable_payments rp
        LEFT JOIN customers c ON c.id = rp.customer_id
        LEFT JOIN receivable_payment_allocations rpa ON rpa.receivable_payment_id = rp.id
        LEFT JOIN accounts_receivable ar ON ar.id = rpa.accounts_receivable_id
        WHERE rp.company_id = :company_id
    """
    params = {"company_id": company_id}
    if fecha_desde:
        query += " AND rp.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        query += " AND rp.fecha <= :fecha_hasta"
        params["fecha_hasta"] = fecha_hasta
    query += " GROUP BY rp.id, c.razon_social ORDER BY rp.fecha DESC, rp.created_at DESC"

    result = await db.execute(text(query), params)
    rows = []
    for row in result.fetchall():
        d = dict(row._mapping)
        if isinstance(d["allocations"], str):
            import json as _json
            d["allocations"] = _json.loads(d["allocations"])
        rows.append(d)
    return rows


# ── Cobranza Global en Cascada (FIFO) ──────────────────────────────────

async def apply_global_payment(
    db: AsyncSession,
    company_id: str,
    data,
    registrado_por: str | None,
) -> dict:
    """Aplica un pago global en cascada FIFO (más antiguas primero) a las facturas
    pendientes de un cliente. Si el usuario seleccionó un lote específico de
    facturas (accounts_receivable_ids), se aplica en orden de vencimiento sobre ese lote.
    Si sobra dinero luego de saldar una factura, se amortiza la siguiente.
    Actualiza cuentas por cobrar, líneas de crédito y rastro de auditoría."""
    query = """
        SELECT id, numero_documento, fecha_emision, fecha_vencimiento, monto_original, saldo_pendiente, customer_id
        FROM accounts_receivable
        WHERE company_id = :company_id AND customer_id = :customer_id AND estado = 'pendiente' AND saldo_pendiente > 0
    """
    params = {"company_id": company_id, "customer_id": str(data.customer_id)}

    if data.accounts_receivable_ids:
        query += " AND id = ANY(:ids)"
        params["ids"] = [str(i) for i in data.accounts_receivable_ids]

    query += " ORDER BY fecha_vencimiento ASC NULLS LAST, fecha_emision ASC, created_at ASC"

    result = await db.execute(text(query), params)
    docs = result.fetchall()

    if not docs:
        return {"error": "El cliente no posee facturas pendientes de cobro para imputar el pago."}

    total_deuda = sum(Decimal(str(d.saldo_pendiente)) for d in docs)
    monto_pago = Decimal(str(data.monto_total))

    if monto_pago > total_deuda:
        return {
            "error": f"El monto del pago (Gs. {int(monto_pago):,}) excede el total de saldo pendiente disponible (Gs. {int(total_deuda):,})."
        }

    # Obtener datos del cliente para el rastro y el comprobante
    cust_res = await db.execute(
        text("SELECT razon_social, nombre_fantasia, ruc FROM customers WHERE id = :cid"),
        {"cid": str(data.customer_id)},
    )
    cust_row = cust_res.first()
    customer_name = (cust_row.razon_social or cust_row.nombre_fantasia or "Cliente") if cust_row else "Cliente"
    customer_ruc = (cust_row.ruc or "—") if cust_row else "—"

    payment_id = uuid.uuid4()
    numero_recibo = f"REC-{str(payment_id)[:8].upper()}"
    fecha_pago = data.fecha or date.today()

    await db.execute(
        text("""
            INSERT INTO receivable_payments
                (id, company_id, customer_id, monto_total, moneda, forma_pago, referencia, fecha, observaciones, registrado_por)
            VALUES (:id, :company_id, :customer_id, :monto_total, :moneda, :forma_pago, :referencia, :fecha, :observaciones, :registrado_por)
        """),
        {
            "id": payment_id,
            "company_id": company_id,
            "customer_id": str(data.customer_id),
            "monto_total": float(monto_pago),
            "moneda": data.moneda or "PYG",
            "forma_pago": data.forma_pago or "efectivo",
            "referencia": data.referencia,
            "fecha": fecha_pago,
            "observaciones": data.observaciones,
            "registrado_por": registrado_por,
        },
    )

    restante = monto_pago
    aplicados = []

    for doc in docs:
        if restante <= Decimal("0"):
            break

        saldo_actual = Decimal(str(doc.saldo_pendiente))
        monto_a_aplicar = min(restante, saldo_actual)

        if monto_a_aplicar <= Decimal("0"):
            continue

        nuevo_saldo = saldo_actual - monto_a_aplicar
        nuevo_estado = "pagado" if nuevo_saldo <= Decimal("0") else "pendiente"

        await db.execute(
            text("""
                UPDATE accounts_receivable
                SET saldo_pendiente = :saldo, estado = :estado, ultimo_pago = NOW()
                WHERE id = :id
            """),
            {
                "saldo": float(max(Decimal("0"), nuevo_saldo)),
                "estado": nuevo_estado,
                "id": str(doc.id),
            },
        )

        await db.execute(
            text("""
                INSERT INTO receivable_payment_allocations (receivable_payment_id, accounts_receivable_id, monto)
                VALUES (:payment_id, :ar_id, :monto)
            """),
            {
                "payment_id": payment_id,
                "ar_id": str(doc.id),
                "monto": float(monto_a_aplicar),
            },
        )

        aplicados.append({
            "accounts_receivable_id": str(doc.id),
            "numero_documento": doc.numero_documento,
            "monto_aplicado": float(monto_a_aplicar),
            "saldo_anterior": float(saldo_actual),
            "nuevo_saldo": float(max(Decimal("0"), nuevo_saldo)),
            "nuevo_estado": nuevo_estado,
        })

        restante -= monto_a_aplicar

    # Actualizar línea de crédito
    await db.execute(
        text("""
            UPDATE credit_accounts
            SET saldo_utilizado = GREATEST(0, saldo_utilizado - :monto),
                saldo_disponible = LEAST(limite_credito, saldo_disponible + :monto)
            WHERE company_id = :company_id AND customer_id = :customer_id
        """),
        {"monto": float(monto_pago), "company_id": company_id, "customer_id": str(data.customer_id)},
    )
    nuevo_saldo_utilizado = await db.execute(
        text("SELECT saldo_utilizado FROM credit_accounts WHERE company_id = :company_id AND customer_id = :customer_id"),
        {"company_id": company_id, "customer_id": str(data.customer_id)},
    )
    row = nuevo_saldo_utilizado.first()
    if row is not None:
        await db.execute(
            text("UPDATE customers SET credito_usado = :monto WHERE id = :customer_id"),
            {"monto": float(row.saldo_utilizado), "customer_id": str(data.customer_id)},
        )

    treasury_res = await _record_treasury_ingress(
        db=db,
        company_id=company_id,
        payment_id=payment_id,
        customer_id=str(data.customer_id),
        customer_name=customer_name,
        customer_ruc=customer_ruc,
        monto=monto_pago,
        data=data,
        registrado_por=registrado_por,
        numero_recibo=numero_recibo,
    )

    await db.flush()
    return {
        "payment_id": str(payment_id),
        "id": str(payment_id),
        "numero_recibo": numero_recibo,
        "monto_total": float(monto_pago),
        "documentos_afectados": len(aplicados),
        "allocations": aplicados,
        "treasury": treasury_res,
    }


# ── Datos para Reporte Detallado de Deuda y Recibo A6 ─────────────────

async def get_deuda_detallada_data(
    db: AsyncSession,
    company_id: str,
    customer_id: str | None = None,
    empresa_vinculada: str | None = None,
    solo_con_saldo: bool = True,
) -> dict:
    """Trae la información estructurada y agrupada por cliente de las facturas y
    deudas pendientes para el reporte detallado en PDF, con soporte para filtrado
    por cliente específico y empresa vinculada."""
    today = date.today()
    query = """
        SELECT
            ar.id, ar.customer_id, ar.sale_id, ar.numero_documento,
            ar.fecha_emision, ar.fecha_vencimiento, ar.moneda,
            ar.monto_original, ar.saldo_pendiente, ar.tipo, ar.estado,
            COALESCE(c.razon_social, c.nombre_fantasia, 'Cliente') as customer_name,
            c.nombre_fantasia, c.ruc as customer_ruc,
            c.telefono as customer_telefono, c.empresa_vinculada_nombre, c.empresa_vinculada_ruc,
            COALESCE(ca.limite_credito, c.limite_credito, 0) as limite_credito,
            CASE
                WHEN ar.estado <> 'pendiente' THEN 0
                WHEN ar.fecha_vencimiento IS NULL THEN 0
                ELSE (DATE(:today) - ar.fecha_vencimiento)::int
            END as dias_mora
        FROM accounts_receivable ar
        LEFT JOIN customers c ON c.id = ar.customer_id
        LEFT JOIN credit_accounts ca ON ca.customer_id = ar.customer_id AND ca.company_id = ar.company_id
        WHERE ar.company_id = :company_id
    """
    params = {"company_id": company_id, "today": today}

    if solo_con_saldo:
        query += " AND ar.estado = 'pendiente' AND ar.saldo_pendiente > 0"
    if customer_id:
        query += " AND ar.customer_id = :customer_id"
        params["customer_id"] = customer_id
    if empresa_vinculada:
        query += " AND c.empresa_vinculada_nombre ILIKE :empresa_vinculada"
        params["empresa_vinculada"] = f"%{empresa_vinculada.strip()}%"

    query += " ORDER BY COALESCE(c.razon_social, 'Cliente') ASC, ar.fecha_vencimiento ASC NULLS LAST, ar.fecha_emision ASC"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    clientes_dict: dict = {}
    total_general_saldo = Decimal("0")
    total_general_original = Decimal("0")
    total_facturas = len(rows)

    b_al_dia = Decimal("0")
    b_1_30 = Decimal("0")
    b_31_60 = Decimal("0")
    b_61_90 = Decimal("0")
    b_91_plus = Decimal("0")

    for r in rows:
        cid = str(r.customer_id)
        saldo = Decimal(str(r.saldo_pendiente or 0))
        orig = Decimal(str(r.monto_original or 0))
        dias = r.dias_mora or 0

        total_general_saldo += saldo
        total_general_original += orig

        if dias <= 0:
            b_al_dia += saldo
        elif dias <= 30:
            b_1_30 += saldo
        elif dias <= 60:
            b_31_60 += saldo
        elif dias <= 90:
            b_61_90 += saldo
        else:
            b_91_plus += saldo

        if cid not in clientes_dict:
            clientes_dict[cid] = {
                "customer_id": cid,
                "customer_name": r.customer_name,
                "customer_ruc": r.customer_ruc or "—",
                "customer_telefono": r.customer_telefono or "—",
                "empresa_vinculada_nombre": r.empresa_vinculada_nombre,
                "empresa_vinculada_ruc": r.empresa_vinculada_ruc,
                "limite_credito": Decimal(str(r.limite_credito or 0)),
                "saldo_total": Decimal("0"),
                "monto_original_total": Decimal("0"),
                "facturas": [],
            }

        cl = clientes_dict[cid]
        cl["saldo_total"] += saldo
        cl["monto_original_total"] += orig
        cl["facturas"].append({
            "id": str(r.id),
            "numero_documento": r.numero_documento or "S/N",
            "fecha_emision": r.fecha_emision,
            "fecha_vencimiento": r.fecha_vencimiento,
            "monto_original": orig,
            "saldo_pendiente": saldo,
            "dias_mora": dias,
            "estado": r.estado,
        })

    clientes_list = sorted(clientes_dict.values(), key=lambda c: c["saldo_total"], reverse=True)

    return {
        "total_saldo_general": total_general_saldo,
        "total_original_general": total_general_original,
        "total_facturas": total_facturas,
        "total_clientes": len(clientes_list),
        "total_vencido": b_1_30 + b_31_60 + b_61_90 + b_91_plus,
        "buckets": {
            "al_dia": b_al_dia,
            "dias_1_30": b_1_30,
            "dias_31_60": b_31_60,
            "dias_61_90": b_61_90,
            "dias_91_plus": b_91_plus,
        },
        "clientes": clientes_list,
        "fecha_corte": today,
    }


async def get_payment_receipt_data(db: AsyncSession, payment_id: str) -> dict | None:
    """Trae toda la información de un pago registrado, el cliente, la empresa
    y las facturas amortizadas con sus montos imputados y saldos restantes."""
    q_pay = text("""
        SELECT
            rp.id, rp.company_id, rp.customer_id, rp.monto_total, rp.moneda,
            rp.forma_pago, rp.referencia, rp.fecha, rp.observaciones, rp.created_at,
            c.razon_social as customer_name, c.nombre_fantasia, c.ruc as customer_ruc,
            c.telefono as customer_telefono, c.empresa_vinculada_nombre,
            comp.razon_social as comp_razon_social, comp.ruc as comp_ruc,
            comp.nombre_fantasia as comp_nombre_fantasia, comp.logo_url as comp_logo_url
        FROM receivable_payments rp
        LEFT JOIN customers c ON c.id = rp.customer_id
        LEFT JOIN companies comp ON comp.id = rp.company_id
        WHERE rp.id = :id
    """)
    r_pay = await db.execute(q_pay, {"id": payment_id})
    row = r_pay.fetchone()
    if not row:
        return None

    q_alloc = text("""
        SELECT
            rpa.id, rpa.monto,
            ar.numero_documento, ar.fecha_emision, ar.fecha_vencimiento,
            ar.monto_original, ar.saldo_pendiente, ar.estado
        FROM receivable_payment_allocations rpa
        LEFT JOIN accounts_receivable ar ON ar.id = rpa.accounts_receivable_id
        WHERE rpa.receivable_payment_id = :payment_id
        ORDER BY ar.fecha_vencimiento ASC NULLS LAST, ar.fecha_emision ASC
    """)
    alloc_res = await db.execute(q_alloc, {"payment_id": payment_id})
    allocations = [dict(a._mapping) for a in alloc_res.fetchall()]

    pay_dict = dict(row._mapping)
    pay_dict["allocations"] = allocations
    pay_dict["numero_recibo"] = f"REC-{str(payment_id)[:8].upper()}"
    return pay_dict


# ── CONVENIOS DE EMPRESAS VINCULADAS Y REMISIONES CORPORATIVAS ─────────────────

async def get_corporate_agreements_summary(db: AsyncSession, company_id: str) -> list[dict]:
    """Lista consolidada de empresas vinculadas con funcionarios socios Extra Club.
    Muestra total de funcionarios, cuántos tienen deuda pendiente de corte,
    monto total acumulado listo para corte y remisiones históricas."""
    query = text("""
        SELECT
            TRIM(c.empresa_vinculada_nombre) as empresa_nombre,
            MAX(COALESCE(c.empresa_vinculada_ruc, '')) as empresa_ruc,
            COUNT(DISTINCT c.id) as total_funcionarios,
            COUNT(DISTINCT CASE WHEN ar.saldo_pendiente > 0 AND ar.estado = 'pendiente' AND ar.corporate_remission_id IS NULL THEN c.id END) as funcionarios_con_deuda,
            COALESCE(SUM(CASE WHEN ar.estado = 'pendiente' AND ar.corporate_remission_id IS NULL THEN ar.saldo_pendiente ELSE 0 END), 0) as deuda_pendiente_corte,
            COALESCE(COUNT(DISTINCT ar.corporate_remission_id), 0) as total_remisiones
        FROM customers c
        LEFT JOIN accounts_receivable ar ON ar.customer_id = c.id AND ar.company_id = :company_id
        WHERE c.company_id = :company_id
          AND c.empresa_vinculada_nombre IS NOT NULL
          AND TRIM(c.empresa_vinculada_nombre) <> ''
        GROUP BY TRIM(c.empresa_vinculada_nombre)
        ORDER BY deuda_pendiente_corte DESC, empresa_nombre ASC
    """)
    result = await db.execute(query, {"company_id": company_id})
    rows = []
    for r in result.fetchall():
        d = dict(r._mapping)
        d["deuda_pendiente_corte"] = float(d["deuda_pendiente_corte"])
        d["empresa_vinculada_nombre"] = d["empresa_nombre"]
        d["total_saldo_pendiente"] = d["deuda_pendiente_corte"]
        d["cantidad_funcionarios"] = d["funcionarios_con_deuda"]
        rows.append(d)
    return rows


async def get_corporate_agreement_pending_docs(db: AsyncSession, company_id: str, empresa_nombre: str) -> dict:
    """Trae los funcionarios de una empresa vinculada y sus facturas pendientes
    que aún no fueron incluidas en ninguna remisión de corte mensual."""
    query = text("""
        SELECT
            ar.id, ar.customer_id, ar.numero_documento, ar.fecha_emision, ar.fecha_vencimiento,
            ar.monto_original, ar.saldo_pendiente, ar.tipo, ar.estado,
            COALESCE(c.razon_social, c.nombre_fantasia, 'Funcionario') as customer_name,
            c.ruc as customer_ruc, c.ci as ci_numero, c.telefono as customer_telefono,
            c.empresa_vinculada_nombre, c.empresa_vinculada_ruc,
            COALESCE(ca.limite_credito, c.limite_credito, 0) as limite_credito,
            COALESCE(ca.saldo_utilizado, c.credito_usado, 0) as credito_usado
        FROM accounts_receivable ar
        JOIN customers c ON c.id = ar.customer_id
        LEFT JOIN credit_accounts ca ON ca.customer_id = c.id AND ca.company_id = ar.company_id
        WHERE ar.company_id = :company_id
          AND TRIM(c.empresa_vinculada_nombre) ILIKE :empresa_nombre
          AND ar.estado = 'pendiente'
          AND ar.corporate_remission_id IS NULL
        ORDER BY COALESCE(c.razon_social, 'Funcionario') ASC, ar.fecha_vencimiento ASC NULLS LAST, ar.fecha_emision ASC
    """)
    result = await db.execute(query, {"company_id": company_id, "empresa_nombre": f"%{empresa_nombre.strip()}%"})
    rows = result.fetchall()

    funcionarios_dict = {}
    total_deuda = Decimal("0")
    total_documentos = len(rows)

    for r in rows:
        cid = str(r.customer_id)
        saldo = Decimal(str(r.saldo_pendiente or 0))
        orig = Decimal(str(r.monto_original or 0))
        total_deuda += saldo

        if cid not in funcionarios_dict:
            funcionarios_dict[cid] = {
                "customer_id": cid,
                "customer_name": r.customer_name,
                "customer_nombre": r.customer_name,
                "customer_ruc": r.customer_ruc or "—",
                "ci_numero": r.ci_numero or r.customer_ruc or "—",
                "customer_telefono": r.customer_telefono or "—",
                "empresa_vinculada_nombre": r.empresa_vinculada_nombre,
                "empresa_vinculada_ruc": r.empresa_vinculada_ruc,
                "limite_credito": float(r.limite_credito or 0),
                "credito_usado": float(r.credito_usado or 0),
                "saldo_total": 0.0,
                "total_saldo": 0.0,
                "documentos": [],
            }

        fn = funcionarios_dict[cid]
        fn["saldo_total"] += float(saldo)
        fn["total_saldo"] += float(saldo)
        fn["documentos"].append({
            "id": str(r.id),
            "numero_documento": r.numero_documento or "S/N",
            "fecha_emision": r.fecha_emision,
            "fecha_vencimiento": r.fecha_vencimiento,
            "monto_original": float(orig),
            "saldo_pendiente": float(saldo),
            "tipo": r.tipo,
        })

    funcionarios_list = sorted(funcionarios_dict.values(), key=lambda f: f["saldo_total"], reverse=True)
    return {
        "empresa_vinculada_nombre": empresa_nombre,
        "total_deuda": float(total_deuda),
        "total_documentos": total_documentos,
        "cantidad_documentos": total_documentos,
        "total_funcionarios": len(funcionarios_list),
        "cantidad_funcionarios": len(funcionarios_list),
        "funcionarios": funcionarios_list,
    }


async def create_corporate_remission(db: AsyncSession, company_id: str, data, user_id: str | None) -> dict:
    """Ejecuta el Corte y Remisión a la Empresa Vinculada:
    1. Agrupa los comprobantes no remitidos.
    2. Crea el registro consolidado ar_corporate_remissions.
    3. Pasa los comprobantes a 'REMITIDO_EMPRESA' vinculándolos a la remisión.
    4. REHABILITA INMEDIATAMENTE la línea de crédito a los funcionarios descontando su credito_usado
       (la deuda pasó a ser responsabilidad de la empresa empleadora)."""
    empresa_nombre = data.empresa_vinculada_nombre.strip()
    periodo_mes = data.periodo_mes.strip()
    fecha_corte = data.fecha_corte or date.today()
    fecha_remision = date.today()

    if data.accounts_receivable_ids:
        doc_ids = [str(i) for i in data.accounts_receivable_ids]
        q_docs = text("""
            SELECT ar.id, ar.customer_id, ar.saldo_pendiente, c.empresa_vinculada_ruc
            FROM accounts_receivable ar
            JOIN customers c ON c.id = ar.customer_id
            WHERE ar.id = ANY(:ids) AND ar.company_id = :company_id AND ar.estado = 'pendiente' AND ar.corporate_remission_id IS NULL
        """)
        r_docs = await db.execute(q_docs, {"ids": doc_ids, "company_id": company_id})
    else:
        q_docs = text("""
            SELECT ar.id, ar.customer_id, ar.saldo_pendiente, c.empresa_vinculada_ruc
            FROM accounts_receivable ar
            JOIN customers c ON c.id = ar.customer_id
            WHERE ar.company_id = :company_id AND TRIM(c.empresa_vinculada_nombre) ILIKE :empresa
              AND ar.estado = 'pendiente' AND ar.corporate_remission_id IS NULL
        """)
        r_docs = await db.execute(q_docs, {"company_id": company_id, "empresa": f"%{empresa_nombre}%"})

    docs = r_docs.fetchall()
    if not docs:
        return {"error": f"No se encontraron comprobantes pendientes de corte para la empresa {empresa_nombre}"}

    empresa_ruc = docs[0].empresa_vinculada_ruc if docs else None
    total_monto = sum(Decimal(str(d.saldo_pendiente)) for d in docs)
    affected_doc_ids = [str(d.id) for d in docs]

    funcionarios_montos = {}
    for d in docs:
        cid = str(d.customer_id)
        funcionarios_montos[cid] = funcionarios_montos.get(cid, Decimal("0")) + Decimal(str(d.saldo_pendiente))

    cnt_res = await db.execute(
        text("SELECT COUNT(*) FROM ar_corporate_remissions WHERE company_id = :cid AND periodo_mes = :periodo"),
        {"cid": company_id, "periodo": periodo_mes},
    )
    cnt = (cnt_res.scalar() or 0) + 1
    numero_remision = f"REM-{periodo_mes.replace('-', '')}-{cnt:03d}"

    remission_id = uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO ar_corporate_remissions
                (id, company_id, empresa_vinculada_nombre, empresa_vinculada_ruc, numero_remision, periodo_mes,
                 fecha_corte, fecha_remision, monto_total, saldo_pendiente, cantidad_funcionarios, cantidad_documentos,
                 estado, notas, created_by, created_at, updated_at)
            VALUES
                (:id, :company_id, :empresa_nombre, :empresa_ruc, :numero_remision, :periodo_mes,
                 :fecha_corte, :fecha_remision, :monto_total, :saldo_pendiente, :cant_func, :cant_docs,
                 'REMITIDO', :notas, :user_id, NOW(), NOW())
        """),
        {
            "id": remission_id,
            "company_id": company_id,
            "empresa_nombre": empresa_nombre,
            "empresa_ruc": empresa_ruc,
            "numero_remision": numero_remision,
            "periodo_mes": periodo_mes,
            "fecha_corte": fecha_corte,
            "fecha_remision": fecha_remision,
            "monto_total": float(total_monto),
            "saldo_pendiente": float(total_monto),
            "cant_func": len(funcionarios_montos),
            "cant_docs": len(docs),
            "notas": getattr(data, "notas", None),
            "user_id": user_id,
        },
    )

    await db.execute(
        text("""
            UPDATE accounts_receivable
            SET estado = 'REMITIDO_EMPRESA',
                corporate_remission_id = :rem_id,
                remitido_empresa_at = NOW()
            WHERE id = ANY(:ids)
        """),
        {"rem_id": remission_id, "ids": affected_doc_ids},
    )

    # REHABILITAR AUTOMÁTICAMENTE LA LÍNEA DE CRÉDITO DEL FUNCIONARIO
    for cid, monto_remitido in funcionarios_montos.items():
        await db.execute(
            text("""
                UPDATE credit_accounts
                SET saldo_utilizado = GREATEST(0, saldo_utilizado - :monto),
                    saldo_disponible = LEAST(limite_credito, saldo_disponible + :monto)
                WHERE company_id = :company_id AND customer_id = :customer_id
            """),
            {"monto": float(monto_remitido), "company_id": company_id, "customer_id": cid},
        )
        await db.execute(
            text("""
                UPDATE customers
                SET credito_usado = GREATEST(0, credito_usado - :monto)
                WHERE id = :customer_id
            """),
            {"monto": float(monto_remitido), "customer_id": cid},
        )

    await db.flush()
    return {
        "remission_id": str(remission_id),
        "id": str(remission_id),
        "numero_remision": numero_remision,
        "empresa_vinculada_nombre": empresa_nombre,
        "periodo_mes": periodo_mes,
        "monto_total": float(total_monto),
        "cantidad_funcionarios": len(funcionarios_montos),
        "cantidad_documentos": len(docs),
        "estado": "REMITIDO",
    }


async def get_corporate_remissions_list(db: AsyncSession, company_id: str, empresa_nombre: str | None = None) -> list[dict]:
    q = """
        SELECT
            id, company_id, empresa_vinculada_nombre, empresa_vinculada_ruc, numero_remision,
            periodo_mes, fecha_corte, fecha_remision, monto_total, saldo_pendiente,
            cantidad_funcionarios, cantidad_documentos, estado, recibido_por, fecha_recepcion,
            notas, created_at
        FROM ar_corporate_remissions
        WHERE company_id = :company_id
    """
    params = {"company_id": company_id}
    if empresa_nombre:
        q += " AND empresa_vinculada_nombre ILIKE :empresa"
        params["empresa"] = f"%{empresa_nombre.strip()}%"
    q += " ORDER BY created_at DESC"

    res = await db.execute(text(q), params)
    rows = []
    for r in res.fetchall():
        d = dict(r._mapping)
        d["monto_total"] = float(d["monto_total"])
        d["saldo_pendiente"] = float(d["saldo_pendiente"])
        rows.append(d)
    return rows


async def get_corporate_remission_detail(db: AsyncSession, remission_id: str) -> dict | None:
    r_res = await db.execute(
        text("SELECT * FROM ar_corporate_remissions WHERE id = :id"),
        {"id": remission_id},
    )
    r_row = r_res.fetchone()
    if not r_row:
        return None

    rem_dict = dict(r_row._mapping)
    rem_dict["monto_total"] = float(rem_dict["monto_total"])
    rem_dict["saldo_pendiente"] = float(rem_dict["saldo_pendiente"])

    docs_res = await db.execute(
        text("""
            SELECT
                ar.id, ar.customer_id, ar.numero_documento, ar.fecha_emision, ar.fecha_vencimiento,
                ar.monto_original, ar.saldo_pendiente, ar.tipo, ar.estado,
                COALESCE(c.razon_social, c.nombre_fantasia, 'Funcionario') as customer_name,
                c.ruc as customer_ruc, c.ci as ci_numero
            FROM accounts_receivable ar
            JOIN customers c ON c.id = ar.customer_id
            WHERE ar.corporate_remission_id = :rem_id
            ORDER BY COALESCE(c.razon_social, 'Funcionario') ASC, ar.fecha_vencimiento ASC
        """),
        {"rem_id": remission_id},
    )
    docs = docs_res.fetchall()

    funcionarios_dict = {}
    for d in docs:
        cid = str(d.customer_id)
        if cid not in funcionarios_dict:
            funcionarios_dict[cid] = {
                "customer_id": cid,
                "customer_name": d.customer_name,
                "ci_numero": d.ci_numero or d.customer_ruc or "—",
                "customer_ruc": d.customer_ruc or "—",
                "saldo_total": 0.0,
                "cantidad_documentos": 0,
                "documentos": [],
            }
        fn = funcionarios_dict[cid]
        s = float(d.saldo_pendiente or d.monto_original or 0)
        fn["saldo_total"] += s
        fn["cantidad_documentos"] += 1
        fn["documentos"].append({
            "id": str(d.id),
            "numero_documento": d.numero_documento or "S/N",
            "fecha_emision": d.fecha_emision,
            "fecha_vencimiento": d.fecha_vencimiento,
            "monto_original": float(d.monto_original or 0),
            "saldo_pendiente": float(d.saldo_pendiente or 0),
            "tipo": d.tipo,
        })

    rem_dict["funcionarios"] = list(funcionarios_dict.values())
    return rem_dict


async def pay_corporate_remission(db: AsyncSession, company_id: str, remission_id: str, data, user_id: str | None) -> dict:
    r_res = await db.execute(
        text("SELECT * FROM ar_corporate_remissions WHERE id = :id AND company_id = :cid"),
        {"id": remission_id, "cid": company_id},
    )
    rem = r_res.fetchone()
    if not rem:
        return {"error": "Remisión corporativa no encontrada"}

    saldo_actual = Decimal(str(rem.saldo_pendiente))
    if saldo_actual <= Decimal("0"):
        return {"error": "La remisión ya se encuentra totalmente saldada"}

    monto_pago = Decimal(str(data.monto))
    if monto_pago > saldo_actual:
        return {"error": f"El monto del pago (Gs. {int(monto_pago):,}) supera el saldo adeudado por la empresa (Gs. {int(saldo_actual):,})"}

    empresa_nombre = rem.empresa_vinculada_nombre
    numero_recibo = f"REC-CORP-{rem.numero_remision}"
    forma_pago = (data.forma_pago or "transferencia").lower()

    if forma_pago in ("transferencia", "deposito_bancario", "deposito", "pix", "qr") and getattr(data, "bank_account_id", None):
        bank_tx_id = uuid.uuid4()
        await db.execute(
            text("""
                INSERT INTO bank_transactions
                    (id, company_id, bank_account_id, fecha, tipo, monto, moneda, descripcion, referencia, contraparte, conciliado, fecha_conciliacion, categoria, created_at)
                VALUES
                    (:id, :company_id, :bank_account_id, :fecha, 'credito', :monto, 'PYG', :descripcion, :referencia, :contraparte, true, NOW(), 'cobranzas_corporativas', NOW())
            """),
            {
                "id": bank_tx_id,
                "company_id": company_id,
                "bank_account_id": str(data.bank_account_id),
                "fecha": getattr(data, "fecha_pago", None) or date.today(),
                "monto": float(monto_pago),
                "descripcion": f"Cobro Remisión {rem.numero_remision} - {empresa_nombre}",
                "referencia": getattr(data, "referencia", None),
                "contraparte": empresa_nombre,
            },
        )
        await db.execute(
            text("UPDATE bank_accounts SET saldo_actual = saldo_actual + :monto, updated_at = NOW() WHERE id = :id"),
            {"monto": float(monto_pago), "id": str(data.bank_account_id)},
        )
    elif forma_pago == "efectivo":
        await db.execute(
            text("""
                INSERT INTO vault_entries
                    (id, company_id, origen, monto_pyg, estado, observaciones, registrado_por, created_at)
                VALUES
                    (gen_random_uuid(), :company_id, 'cobranza_ar', :monto, 'en_boveda', :obs, :user_id, NOW())
            """),
            {
                "company_id": company_id,
                "monto": float(monto_pago),
                "obs": f"Cobro Remisión {rem.numero_remision} - {empresa_nombre}",
                "user_id": user_id,
            },
        )

    nuevo_saldo = saldo_actual - monto_pago
    nuevo_estado = "PAGADO" if nuevo_saldo <= Decimal("0") else "PAGADO_PARCIAL"

    await db.execute(
        text("""
            UPDATE ar_corporate_remissions
            SET saldo_pendiente = :saldo,
                estado = :estado,
                fecha_recepcion = COALESCE(:fecha_pago, CURRENT_DATE),
                updated_at = NOW()
            WHERE id = :id
        """),
        {"saldo": float(nuevo_saldo), "estado": nuevo_estado, "fecha_pago": getattr(data, "fecha_pago", None), "id": remission_id},
    )

    if nuevo_estado == "PAGADO":
        await db.execute(
            text("""
                UPDATE accounts_receivable
                SET estado = 'pagado', saldo_pendiente = 0, ultimo_pago = NOW()
                WHERE corporate_remission_id = :rem_id
            """),
            {"rem_id": remission_id},
        )

    await db.flush()
    return {
        "remission_id": str(remission_id),
        "numero_remision": rem.numero_remision,
        "monto_pagado": float(monto_pago),
        "saldo_pendiente": float(nuevo_saldo),
        "estado": nuevo_estado,
    }


