from __future__ import annotations
import logging
from decimal import Decimal
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo
import uuid
import json

from sqlalchemy import select, text, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.integrated_finance.auto_posting import (
    PostingEngine,
    ACC_CAJA,
    ACC_CXC,
    ACC_IVA_CREDITO,
    ACC_DESCUENTOS_OTORGADOS,
    ACC_INGRESOS_ADMINISTRATIVOS,
    ACC_GASTOS_VARIOS,
)

logger = logging.getLogger(__name__)



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
            c.empresa_vinculada_nombre,
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
                "empresa_vinculada_nombre": getattr(row, "empresa_vinculada_nombre", None),
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
        "por_clientes": sorted(customer_aging.values(), key=lambda x: (x.get("customer_name") or "").upper().strip()),
        "fecha": today,
    }


async def get_accounts_receivable(
    db: AsyncSession, company_id: str, customer_id: str | None = None,
    estado: str | None = None, search: str | None = None,
    limit: int | None = None, offset: int = 0,
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
            c.empresa_vinculada_nombre,
            CASE
                WHEN ar.estado <> 'pendiente' THEN 0
                WHEN ar.fecha_vencimiento IS NULL THEN 0
                ELSE (DATE(:today) - ar.fecha_vencimiento)::int
            END as dias_mora
        FROM accounts_receivable ar
        LEFT JOIN customers c ON c.id = ar.customer_id
        WHERE ar.company_id = :company_id
    """)
    params = {"company_id": company_id, "today": today, "offset": offset}
    if customer_id:
        query = text(query.text + " AND ar.customer_id = :customer_id")
        params["customer_id"] = customer_id
    if estado:
        query = text(query.text + " AND ar.estado = :estado")
        params["estado"] = estado
    if search:
        s = f"%{search.strip()}%"
        query = text(query.text + " AND (ar.numero_documento ILIKE :search OR c.razon_social ILIKE :search OR c.nombre_fantasia ILIKE :search OR c.ruc ILIKE :search OR c.empresa_vinculada_nombre ILIKE :search)")
        params["search"] = s
    # Los documentos pagados nunca cambian su fecha_vencimiento (queda fija en
    # el pasado) — ordenar solo por fecha hacia el frente hacia que, sin filtro
    # de estado, las primeras filas de la pagina sean puro historico ya
    # saldado en vez de la deuda real vigente. Pendientes primero, mas viejos
    # primero dentro de cada grupo (para priorizar la mora mas antigua).
    limit_clause = ""
    if limit is not None:
        params["limit"] = limit
        limit_clause = "LIMIT :limit"

    query = text(query.text + f"""
        ORDER BY CASE WHEN ar.estado = 'pendiente' THEN 0 ELSE 1 END, ar.fecha_vencimiento ASC NULLS LAST
        {limit_clause} OFFSET :offset
    """)

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
    tipo: str = "factura", fecha_emision: datetime | None = None,
) -> None:
    if not fecha_vencimiento:
        base_date = fecha_emision.date() if fecha_emision else date.today()
        fecha_vencimiento = base_date + timedelta(days=30)

    await db.execute(
        text("""
            INSERT INTO accounts_receivable
                (company_id, customer_id, sale_id, numero_documento, fecha_emision,
                 fecha_vencimiento, moneda, monto_original, saldo_pendiente, tipo, estado)
            VALUES
                (:company_id, :customer_id, :sale_id, :numero_documento, COALESCE(:fecha_emision, NOW()),
                 :fecha_vencimiento, 'PYG', :monto, :monto, :tipo, 'pendiente')
        """),
        {
            "company_id": company_id,
            "customer_id": customer_id,
            "sale_id": sale_id,
            "numero_documento": numero,
            "fecha_emision": fecha_emision,
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
    ordenados por vencimiento (mas viejo primero) para facilitar el reparto.
    Incluye desglose fiscal exacto (IVA 10%, IVA 5%, exentas) vinculado a la venta para cálculo de retenciones Tesakã."""
    result = await db.execute(
        text("""
            SELECT ar.id, ar.numero_documento, ar.fecha_emision, ar.fecha_vencimiento, ar.moneda,
                   ar.monto_original, ar.saldo_pendiente,
                   CASE WHEN ar.fecha_vencimiento IS NULL THEN 0 ELSE (CURRENT_DATE - ar.fecha_vencimiento)::int END as dias_mora,
                   COALESCE(s.iva_10, 0) as iva_10,
                   COALESCE(s.iva_5, 0) as iva_5,
                   COALESCE(s.base_gravada_10, 0) as base_gravada_10,
                   COALESCE(s.base_gravada_5, 0) as base_gravada_5,
                   COALESCE(s.base_exenta, 0) as base_exenta,
                   COALESCE(s.total, ar.monto_original) as total_factura
            FROM accounts_receivable ar
            LEFT JOIN sales s ON ar.sale_id = s.id
            WHERE ar.company_id = :company_id AND ar.customer_id = :customer_id AND ar.estado = 'pendiente'
            ORDER BY ar.fecha_vencimiento ASC NULLS LAST
        """),
        {"company_id": company_id, "customer_id": customer_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


async def _post_ar_payment_accounting(
    db: AsyncSession,
    company_id: str,
    payment_id: uuid.UUID,
    fecha: date,
    numero_recibo: str,
    customer_name: str,
    monto_total: Decimal,
    aplica_retencion: bool,
    monto_retencion: Decimal,
    retencion_numero_comprobante: str | None,
    tipo_diferencia: str = "exacto",
    diferencia_monto: Decimal = Decimal("0"),
    monto_facturas_canceladas: Decimal | None = None,
    forma_pago: str = "efectivo",
) -> None:
    """Genera el asiento contable de partida doble para el cobro o compensación de CxC:
    - Si forma_pago == 'compensacion_interna':
        DEBE: Gastos Operativos (6.1.07)
        HABER: Cuentas por Cobrar Clientes (1.1.02)
    - En cobros normales:
        DEBE: Caja y Bancos (1.1.01) por el dinero neto recibido (monto_total - retención)
        DEBE: IVA Crédito Fiscal (1.1.05) por la retención soportada (comprobante Tesakã)
        DEBE: Descuentos Otorgados (5.1.02) si tipo_diferencia == 'descuento' (redondeo a favor del cliente)
        HABER: Cuentas por Cobrar Clientes (1.1.02) por el total cancelado de la deuda (monto_facturas_canceladas)
        HABER: Ingresos Administrativos / Cobranza (4.2.01) si tipo_diferencia == 'gastos_administrativos'
    Garantiza balance exacto (Total DEBE == Total HABER) y registro auditable."""
    try:
        engine = PostingEngine(db, company_id)
        await engine.ensure_accounts()

        monto_facturas_q = Decimal(
            str(monto_facturas_canceladas if monto_facturas_canceladas is not None else monto_total)
        ).quantize(Decimal("1"))

        if forma_pago == "compensacion_interna":
            lines_comp: list[tuple[str, str, Decimal]] = []
            if monto_facturas_q > 0:
                lines_comp.append((ACC_GASTOS_VARIOS, "debe", monto_facturas_q))
                lines_comp.append((ACC_CXC, "haber", monto_facturas_q))
            concepto_comp = f"Compensación Consumo Interno Recibo #{numero_recibo} - {customer_name}"
            await engine.post(fecha, concepto_comp, "receivable_payment", payment_id, lines_comp)
            return

        monto_entregado_q = Decimal(str(monto_total)).quantize(Decimal("1"))
        monto_ret_q = Decimal(str(monto_retencion)).quantize(Decimal("1")) if aplica_retencion else Decimal("0")
        monto_neto_caja = max(Decimal("0"), monto_entregado_q - monto_ret_q)
        monto_dif_q = Decimal(str(diferencia_monto or 0)).quantize(Decimal("1"))

        lines: list[tuple[str, str, Decimal]] = []
        if monto_neto_caja > 0:
            lines.append((ACC_CAJA, "debe", monto_neto_caja))
        if monto_ret_q > 0:
            lines.append((ACC_IVA_CREDITO, "debe", monto_ret_q))
        if monto_dif_q > 0 and tipo_diferencia == "descuento":
            lines.append((ACC_DESCUENTOS_OTORGADOS, "debe", monto_dif_q))

        if monto_facturas_q > 0:
            lines.append((ACC_CXC, "haber", monto_facturas_q))
        if monto_dif_q > 0 and tipo_diferencia == "gastos_administrativos":
            lines.append((ACC_INGRESOS_ADMINISTRATIVOS, "haber", monto_dif_q))

        concepto = f"Cobro Recibo #{numero_recibo} - {customer_name}"
        if aplica_retencion and retencion_numero_comprobante:
            concepto += f" (Ret. IVA Tesakã #{retencion_numero_comprobante})"
        if tipo_diferencia == "descuento" and monto_dif_q > 0:
            concepto += f" [Descuento: Gs. {int(monto_dif_q):,}]"
        elif tipo_diferencia == "gastos_administrativos" and monto_dif_q > 0:
            concepto += f" [Gastos Admin: Gs. {int(monto_dif_q):,}]"

        await engine.post(fecha, concepto, "receivable_payment", payment_id, lines)
    except Exception as e:
        logger.warning("No se pudo postear asiento contable para cobro AR %s: %s", payment_id, e)


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
    - Efectivo: genera entrada en VaultEntry (Bóveda Central con desglose en PYG, BRL y USD) o vincula caja_session_id.
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

    # 1. Ingreso de Efectivo en Bóveda / Caja (si aplica)
    if forma_pago in ("efectivo", "mixto"):
        monto_pyg = Decimal(str(getattr(data, "monto_pyg", 0) or 0))
        monto_brl = Decimal(str(getattr(data, "monto_brl", 0) or 0))
        monto_usd = Decimal(str(getattr(data, "monto_usd", 0) or 0))
        if forma_pago == "efectivo" and monto_pyg == 0 and monto_brl == 0 and monto_usd == 0:
            mon_str = (getattr(data, "moneda", "PYG") or "PYG").upper()
            if mon_str == "BRL":
                monto_brl = monto
            elif mon_str == "USD":
                monto_usd = monto
            else:
                monto_pyg = monto

        if (monto_pyg > 0 or monto_brl > 0 or monto_usd > 0) and not (destino_fondos == "caja" and caja_session_id):
            det_monedas = []
            if monto_pyg > 0:
                det_monedas.append(f"Gs. {int(monto_pyg):,}")
            if monto_brl > 0:
                det_monedas.append(f"R$ {monto_brl:,.2f}")
            if monto_usd > 0:
                det_monedas.append(f"US$ {monto_usd:,.2f}")
            det_str = f" ({' + '.join(det_monedas)})" if det_monedas else ""

            vault_entry_id = uuid.uuid4()
            await db.execute(
                text("""
                    INSERT INTO vault_entries
                        (id, company_id, origen, monto_pyg, monto_brl, monto_usd, estado, observaciones, registrado_por, created_at)
                    VALUES
                        (:id, :company_id, 'cobranza_ar', :monto_pyg, :monto_brl, :monto_usd, 'en_boveda', :obs, :user_id, NOW())
                """),
                {
                    "id": vault_entry_id,
                    "company_id": company_id,
                    "monto_pyg": float(monto_pyg),
                    "monto_brl": float(monto_brl),
                    "monto_usd": float(monto_usd),
                    "obs": f"Cobro AR Recibo #{numero_recibo}{det_str} - Cliente: {customer_name}",
                    "user_id": registrado_por,
                },
            )

    # 2. Depósito / Transferencia / PIX / QR a Cuenta Bancaria
    if (forma_pago in ("transferencia", "deposito_bancario", "deposito", "pix", "qr") or forma_pago == "mixto") and bank_account_id:
        m_banco = Decimal(str(getattr(data, "monto_transferencia", 0) or (monto if forma_pago != "mixto" else 0)))
        if m_banco > 0:
            bank_tx_id = uuid.uuid4()
            desc_tipo = "Depósito Bancario" if "deposito" in forma_pago else ("PIX" if forma_pago == "pix" else ("QR" if forma_pago == "qr" else "Transferencia"))
            ref_val = getattr(data, "referencia_transferencia", None) or getattr(data, "referencia", None)
            ref_str = f" - Boleta/Ref: {ref_val}" if ref_val else ""
            fecha_op = getattr(data, "fecha_transferencia", None) or getattr(data, "fecha", None) or date.today()
            await db.execute(
                text("""
                    INSERT INTO bank_transactions
                        (id, company_id, bank_account_id, fecha, tipo, monto, moneda, descripcion, referencia, contraparte, conciliado, fecha_conciliacion, categoria, created_at)
                    VALUES
                        (:id, :company_id, :bank_account_id, :fecha, 'credito', :monto, :moneda, :descripcion, :referencia, :contraparte, false, NULL, 'cobranzas', NOW())
                """),
                {
                    "id": bank_tx_id,
                    "company_id": company_id,
                    "bank_account_id": str(bank_account_id),
                    "fecha": fecha_op,
                    "monto": float(m_banco),
                    "moneda": getattr(data, "moneda", "PYG") or "PYG",
                    "descripcion": f"Cobro AR {desc_tipo} Recibo #{numero_recibo}{ref_str} - Cliente: {customer_name}",
                    "referencia": ref_val,
                    "contraparte": customer_name,
                },
            )
            await db.execute(
                text("""
                    UPDATE bank_accounts
                    SET saldo_actual = saldo_actual + :monto, updated_at = NOW()
                    WHERE id = :bank_account_id
                """),
                {"monto": float(m_banco), "bank_account_id": str(bank_account_id)},
            )

    # 3. Uno o Varios Cheques Recibidos
    if forma_pago in ("cheque", "mixto"):
        cheques_in = getattr(data, "cheques", None)
        if cheques_in and isinstance(cheques_in, list):
            for ch in cheques_in:
                c_num = ch.get("numero") or ch.get("numero_cheque")
                c_monto = Decimal(str(ch.get("monto", 0) or 0))
                if c_monto <= 0:
                    continue
                ch_id = uuid.uuid4()
                c_em = ch.get("fecha_emision") or getattr(data, "fecha", None) or date.today()
                c_cob = ch.get("fecha_cobro") or ch.get("fecha_vencimiento") or c_em
                dif = bool(c_cob and c_em and str(c_cob) > str(c_em))
                await db.execute(
                    text("""
                        INSERT INTO cheques
                            (id, company_id, numero, banco_emisor, beneficiario, librador_nombre, librador_documento,
                             monto, moneda, fecha_emision, fecha_pago, diferido, estado, tipo_cheque, customer_id,
                             receivable_payment_id, concepto, notas, created_by, created_at, updated_at)
                        VALUES
                            (:id, :company_id, :numero, :banco, 'Extra Supermercado Mayorista', :librador, :ruc,
                             :monto, :moneda, :f_emision, :f_pago, :diferido, 'en_cartera', 'recibido', :cust_id,
                             :payment_id, :concepto, :notas, :user_id, NOW(), NOW())
                    """),
                    {
                        "id": ch_id,
                        "company_id": company_id,
                        "numero": c_num or f"CHQ-{str(ch_id)[:8].upper()}",
                        "banco": ch.get("banco") or ch.get("banco_emisor") or "N/A",
                        "librador": ch.get("librador") or customer_name,
                        "ruc": ch.get("ruc") or customer_ruc,
                        "monto": float(c_monto),
                        "moneda": ch.get("moneda") or "PYG",
                        "f_emision": c_em,
                        "f_pago": c_cob,
                        "diferido": dif,
                        "cust_id": customer_id,
                        "payment_id": payment_id,
                        "concepto": f"Cobro AR Recibo #{numero_recibo}",
                        "notas": getattr(data, "observaciones", None),
                        "user_id": registrado_por,
                    },
                )
                cheque_id = ch_id
        elif getattr(data, "cheque_numero", None) or (forma_pago == "cheque" and monto > 0):
            m_ch = Decimal(str(getattr(data, "monto_cheque", 0) or (monto if forma_pago != "mixto" else 0)))
            if m_ch > 0:
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
                             :monto, :moneda, :f_emision, :f_pago, :diferido, 'en_cartera', 'recibido', :cust_id,
                             :payment_id, :concepto, :notas, :user_id, NOW(), NOW())
                    """),
                    {
                        "id": cheque_id,
                        "company_id": company_id,
                        "numero": getattr(data, "cheque_numero", None) or f"CHQ-{str(payment_id)[:8].upper()}",
                        "banco": getattr(data, "cheque_banco", None) or "N/A",
                        "librador": getattr(data, "cheque_librador", None) or customer_name,
                        "ruc": getattr(data, "cheque_ruc", None) or customer_ruc,
                        "monto": float(m_ch),
                        "moneda": getattr(data, "moneda", "PYG") or "PYG",
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
    indique. Valida que el reparto cubra las facturas a cancelar, admite pagos
    multimoneda y compensa desbalanceos por redondeo o tipo de cambio contra
    descuentos o gastos administrativos."""
    total_allocado = sum(a.monto for a in data.allocations)

    monto_pyg = Decimal(str(getattr(data, "monto_pyg", 0) or 0))
    monto_brl = Decimal(str(getattr(data, "monto_brl", 0) or 0))
    monto_usd = Decimal(str(getattr(data, "monto_usd", 0) or 0))
    tasa_brl = Decimal(str(getattr(data, "tasa_brl", 1) or 1))
    tasa_usd = Decimal(str(getattr(data, "tasa_usd", 1) or 1))

    if monto_pyg > 0 or monto_brl > 0 or monto_usd > 0:
        monto_entregado_gs = (monto_pyg + (monto_brl * tasa_brl) + (monto_usd * tasa_usd)).quantize(Decimal("1"))
    else:
        monto_entregado_gs = Decimal(str(data.monto_total)).quantize(Decimal("1"))

    monto_facturas = Decimal(str(getattr(data, "monto_facturas_canceladas", None) or total_allocado)).quantize(Decimal("1"))

    if total_allocado != monto_facturas:
        return {"error": f"El reparto a documentos ({total_allocado}) no coincide con el total de facturas a cancelar ({monto_facturas})"}

    dif = monto_entregado_gs - monto_facturas
    if dif < Decimal("0"):
        tipo_diferencia = "descuento"
        diferencia_monto = abs(dif)
    elif dif > Decimal("0"):
        tipo_diferencia = "gastos_administrativos"
        diferencia_monto = dif
    else:
        tipo_diferencia = "exacto"
        diferencia_monto = Decimal("0")

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
    p_date = data.fecha or date.today()
    p_date_str = p_date.strftime("%Y%m%d")
    seq_res = await db.execute(
        text("SELECT count(*) FROM receivable_payments WHERE company_id = :cid AND fecha = :fec"),
        {"cid": company_id, "fec": p_date}
    )
    daily_seq = (seq_res.scalar() or 0) + 1
    numero_recibo = f"REC-{p_date_str}-{daily_seq:04d}"

    aplica_retencion = bool(getattr(data, "aplica_retencion", False))
    monto_retencion = Decimal(str(getattr(data, "monto_retencion", 0) or 0)) if aplica_retencion else Decimal("0")
    retencion_numero_comprobante = getattr(data, "retencion_numero_comprobante", None) if aplica_retencion else None
    retencion_fecha = getattr(data, "retencion_fecha", None) if aplica_retencion else None
    retencion_porcentaje = Decimal(str(getattr(data, "retencion_porcentaje", 30.00) or 30.00)) if aplica_retencion else Decimal("30.00")
    monto_efectivo_recibido = max(Decimal("0"), monto_entregado_gs - monto_retencion)

    bank_account_id = getattr(data, "bank_account_id", None)
    fecha_transferencia = getattr(data, "fecha_transferencia", None)
    referencia_transferencia = getattr(data, "referencia_transferencia", None)
    monto_transferencia = Decimal(str(getattr(data, "monto_transferencia", 0) or 0))
    monto_cheque = Decimal(str(getattr(data, "monto_cheque", 0) or 0))

    await db.execute(
        text("""
            INSERT INTO receivable_payments
                (id, company_id, customer_id, monto_total, moneda, forma_pago, referencia, fecha, observaciones, registrado_por, numero_recibo,
                 aplica_retencion, monto_retencion, retencion_numero_comprobante, retencion_fecha, retencion_porcentaje, monto_efectivo_recibido,
                 monto_pyg, monto_brl, monto_usd, tasa_brl, tasa_usd, monto_facturas_canceladas, diferencia_monto, tipo_diferencia,
                 bank_account_id, fecha_transferencia, monto_transferencia, monto_cheque, referencia_transferencia)
            VALUES (:id, :company_id, :customer_id, :monto_total, :moneda, :forma_pago, :referencia, :fecha, :observaciones, :registrado_por, :numero_recibo,
                 :aplica_retencion, :monto_retencion, :retencion_numero_comprobante, :retencion_fecha, :retencion_porcentaje, :monto_efectivo_recibido,
                 :monto_pyg, :monto_brl, :monto_usd, :tasa_brl, :tasa_usd, :monto_facturas_canceladas, :diferencia_monto, :tipo_diferencia,
                 :bank_account_id, :fecha_transferencia, :monto_transferencia, :monto_cheque, :referencia_transferencia)
        """),
        {
            "id": payment_id, "company_id": company_id, "customer_id": str(data.customer_id),
            "monto_total": float(monto_entregado_gs), "moneda": data.moneda or "PYG", "forma_pago": data.forma_pago,
            "referencia": data.referencia, "fecha": p_date,
            "observaciones": data.observaciones, "registrado_por": registrado_por,
            "numero_recibo": numero_recibo,
            "aplica_retencion": aplica_retencion,
            "monto_retencion": float(monto_retencion),
            "retencion_numero_comprobante": retencion_numero_comprobante,
            "retencion_fecha": retencion_fecha,
            "retencion_porcentaje": float(retencion_porcentaje),
            "monto_efectivo_recibido": float(monto_efectivo_recibido),
            "monto_pyg": float(monto_pyg),
            "monto_brl": float(monto_brl),
            "monto_usd": float(monto_usd),
            "tasa_brl": float(tasa_brl),
            "tasa_usd": float(tasa_usd),
            "monto_facturas_canceladas": float(monto_facturas),
            "diferencia_monto": float(diferencia_monto),
            "tipo_diferencia": tipo_diferencia,
            "bank_account_id": str(bank_account_id) if bank_account_id else None,
            "fecha_transferencia": fecha_transferencia,
            "monto_transferencia": float(monto_transferencia) if monto_transferencia > 0 else None,
            "monto_cheque": float(monto_cheque) if monto_cheque > 0 else None,
            "referencia_transferencia": referencia_transferencia,
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
        {"monto": float(monto_facturas), "company_id": company_id, "customer_id": str(data.customer_id)},
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
        monto=monto_efectivo_recibido,
        data=data,
        registrado_por=registrado_por,
        numero_recibo=numero_recibo,
    )

    await _post_ar_payment_accounting(
        db=db,
        company_id=company_id,
        payment_id=payment_id,
        fecha=p_date,
        numero_recibo=numero_recibo,
        customer_name=customer_name,
        monto_total=monto_entregado_gs,
        aplica_retencion=aplica_retencion,
        monto_retencion=monto_retencion,
        retencion_numero_comprobante=retencion_numero_comprobante,
        tipo_diferencia=tipo_diferencia,
        diferencia_monto=diferencia_monto,
        monto_facturas_canceladas=monto_facturas,
        forma_pago=data.forma_pago or "efectivo",
    )

    await db.flush()
    return {
        "id": str(payment_id),
        "payment_id": str(payment_id),
        "numero_recibo": numero_recibo,
        "monto_total": float(monto_entregado_gs),
        "monto_facturas_canceladas": float(monto_facturas),
        "diferencia_monto": float(diferencia_monto),
        "tipo_diferencia": tipo_diferencia,
        "aplica_retencion": aplica_retencion,
        "monto_retencion": float(monto_retencion),
        "monto_efectivo_recibido": float(monto_efectivo_recibido),
        "retencion_numero_comprobante": retencion_numero_comprobante,
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
            SELECT rp.id, rp.numero_recibo, rp.fecha, rp.monto_total, rp.forma_pago, rp.referencia, rp.observaciones, rp.created_at,
                   rp.bank_account_id, rp.fecha_transferencia, rp.monto_transferencia, rp.monto_cheque, rp.referencia_transferencia,
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
            ar.id, ar.customer_id, c.razon_social as customer_name, c.ruc as customer_ruc,
            c.telefono as customer_telefono, c.empresa_vinculada_nombre, ar.sale_id,
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
                "customer_ruc": getattr(row, "customer_ruc", None) or "—",
                "customer_telefono": getattr(row, "customer_telefono", None) or "—",
                "empresa_vinculada_nombre": getattr(row, "empresa_vinculada_nombre", None),
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
        "por_clientes": sorted(customer_aging.values(), key=lambda x: (x.get("customer_name") or "").upper().strip()),
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

    monto_pyg = Decimal(str(getattr(data, "monto_pyg", 0) or 0))
    monto_brl = Decimal(str(getattr(data, "monto_brl", 0) or 0))
    monto_usd = Decimal(str(getattr(data, "monto_usd", 0) or 0))
    tasa_brl = Decimal(str(getattr(data, "tasa_brl", 1) or 1))
    tasa_usd = Decimal(str(getattr(data, "tasa_usd", 1) or 1))
    monto_cheque = Decimal(str(getattr(data, "monto_cheque", 0) or 0))
    monto_transf = Decimal(str(getattr(data, "monto_transferencia", 0) or 0))

    is_compensacion = getattr(data, "forma_pago", None) == "compensacion_interna"
    categoria_nombre = None

    if is_compensacion:
        if not getattr(data, "category_id", None):
            return {"error": "Debe seleccionar un rubro/categoría de gasto para la compensación de consumo interno."}
        cat_check = await db.execute(
            text("SELECT id, nombre FROM expense_categories WHERE id = :cid AND company_id = :comp_id"),
            {"cid": str(data.category_id), "comp_id": company_id}
        )
        cat_row = cat_check.first()
        if not cat_row:
            return {"error": "El rubro de gasto seleccionado no existe o no pertenece a la empresa."}
        categoria_nombre = cat_row.nombre
        monto_entregado_gs = monto_facturas
        dif = Decimal("0")
        tipo_diferencia = "exacto"
        diferencia_monto = Decimal("0")
    else:
        if monto_pyg > 0 or monto_brl > 0 or monto_usd > 0 or monto_cheque > 0 or monto_transf > 0:
            monto_entregado_gs = (monto_pyg + (monto_brl * tasa_brl) + (monto_usd * tasa_usd) + monto_cheque + monto_transf).quantize(Decimal("1"))
        else:
            monto_entregado_gs = Decimal(str(data.monto_total)).quantize(Decimal("1"))

        dif = monto_entregado_gs - monto_facturas
        if dif < Decimal("0"):
            tipo_diferencia = "descuento"
            diferencia_monto = abs(dif)
        elif dif > Decimal("0"):
            tipo_diferencia = "gastos_administrativos"
            diferencia_monto = dif
        else:
            tipo_diferencia = "exacto"
            diferencia_monto = Decimal("0")

    # Obtener datos del cliente para el rastro y el comprobante
    cust_res = await db.execute(
        text("SELECT razon_social, nombre_fantasia, ruc FROM customers WHERE id = :cid"),
        {"cid": str(data.customer_id)},
    )
    cust_row = cust_res.first()
    customer_name = (cust_row.razon_social or cust_row.nombre_fantasia or "Cliente") if cust_row else "Cliente"
    customer_ruc = (cust_row.ruc or "—") if cust_row else "—"

    payment_id = uuid.uuid4()
    asuncion_today = datetime.now(ZoneInfo("America/Asuncion")).date()
    fecha_pago = data.fecha or asuncion_today
    p_date_str = fecha_pago.strftime("%Y%m%d")
    seq_res = await db.execute(
        text("SELECT count(*) FROM receivable_payments WHERE company_id = :cid AND fecha = :fec"),
        {"cid": company_id, "fec": fecha_pago}
    )
    daily_seq = (seq_res.scalar() or 0) + 1
    numero_recibo = f"REC-{p_date_str}-{daily_seq:04d}"

    aplica_retencion = bool(getattr(data, "aplica_retencion", False))
    monto_retencion = Decimal(str(getattr(data, "monto_retencion", 0) or 0)) if aplica_retencion else Decimal("0")
    retencion_numero_comprobante = getattr(data, "retencion_numero_comprobante", None) if aplica_retencion else None
    retencion_fecha = getattr(data, "retencion_fecha", None) if aplica_retencion else None
    retencion_porcentaje = Decimal(str(getattr(data, "retencion_porcentaje", 30.00) or 30.00)) if aplica_retencion else Decimal("30.00")
    monto_efectivo_recibido = max(Decimal("0"), monto_entregado_gs - monto_retencion)

    bank_account_id = getattr(data, "bank_account_id", None)
    fecha_transferencia = getattr(data, "fecha_transferencia", None)
    referencia_transferencia = getattr(data, "referencia_transferencia", None)

    await db.execute(
        text("""
            INSERT INTO receivable_payments
                (id, company_id, customer_id, monto_total, moneda, forma_pago, referencia, fecha, observaciones, registrado_por, numero_recibo,
                 aplica_retencion, monto_retencion, retencion_numero_comprobante, retencion_fecha, retencion_porcentaje, monto_efectivo_recibido,
                 monto_pyg, monto_brl, monto_usd, tasa_brl, tasa_usd, monto_facturas_canceladas, diferencia_monto, tipo_diferencia,
                 bank_account_id, fecha_transferencia, monto_transferencia, monto_cheque, referencia_transferencia)
            VALUES (:id, :company_id, :customer_id, :monto_total, :moneda, :forma_pago, :referencia, :fecha, :observaciones, :registrado_por, :numero_recibo,
                 :aplica_retencion, :monto_retencion, :retencion_numero_comprobante, :retencion_fecha, :retencion_porcentaje, :monto_efectivo_recibido,
                 :monto_pyg, :monto_brl, :monto_usd, :tasa_brl, :tasa_usd, :monto_facturas_canceladas, :diferencia_monto, :tipo_diferencia,
                 :bank_account_id, :fecha_transferencia, :monto_transferencia, :monto_cheque, :referencia_transferencia)
        """),
        {
            "id": payment_id,
            "company_id": company_id,
            "customer_id": str(data.customer_id),
            "monto_total": float(monto_entregado_gs),
            "moneda": data.moneda or "PYG",
            "forma_pago": data.forma_pago or "efectivo",
            "referencia": data.referencia,
            "fecha": fecha_pago,
            "observaciones": data.observaciones,
            "registrado_por": registrado_por,
            "numero_recibo": numero_recibo,
            "aplica_retencion": aplica_retencion,
            "monto_retencion": float(monto_retencion),
            "retencion_numero_comprobante": retencion_numero_comprobante,
            "retencion_fecha": retencion_fecha,
            "retencion_porcentaje": float(retencion_porcentaje),
            "monto_efectivo_recibido": float(monto_efectivo_recibido),
            "monto_pyg": float(monto_pyg),
            "monto_brl": float(monto_brl),
            "monto_usd": float(monto_usd),
            "tasa_brl": float(tasa_brl),
            "tasa_usd": float(tasa_usd),
            "monto_facturas_canceladas": float(monto_facturas),
            "diferencia_monto": float(diferencia_monto),
            "tipo_diferencia": tipo_diferencia,
            "bank_account_id": str(bank_account_id) if bank_account_id else None,
            "fecha_transferencia": fecha_transferencia,
            "monto_transferencia": float(monto_transf) if monto_transf > 0 else None,
            "monto_cheque": float(monto_cheque) if monto_cheque > 0 else None,
            "referencia_transferencia": referencia_transferencia,
        },
    )

    restante = monto_facturas
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
        {"monto": float(monto_facturas), "company_id": company_id, "customer_id": str(data.customer_id)},
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

    if is_compensacion:
        treasury_res = {"vault_entry_id": None, "bank_tx_id": None, "cheque_id": None}
        await db.execute(
            text("UPDATE receivable_payments SET destino_fondos = 'consumo_interno' WHERE id = :pid"),
            {"pid": payment_id}
        )

        cat_id_str = str(data.category_id)
        cost_center_id_str = str(data.cost_center_id) if getattr(data, "cost_center_id", None) else None

        for app in aplicados:
            doc_id = app["accounts_receivable_id"]
            monto_aplicado = Decimal(str(app["monto_aplicado"]))
            if monto_aplicado <= Decimal("0"):
                continue

            sale_info = await db.execute(
                text("""
                    SELECT s.branch_id, s.timbrado, s.base_gravada_10, s.base_gravada_5,
                           s.base_exenta, s.iva_10, s.iva_5, s.total
                    FROM accounts_receivable ar
                    LEFT JOIN sales s ON s.id = ar.sale_id
                    WHERE ar.id = :arid
                """),
                {"arid": doc_id},
            )
            srow = sale_info.first()

            branch_id = srow.branch_id if (srow and srow.branch_id) else None
            timbrado = (srow.timbrado if (srow and srow.timbrado) else None) or "18545636"

            tot_sale = Decimal(str(srow.total)) if (srow and srow.total) else monto_aplicado
            if srow and tot_sale > 0 and (srow.iva_10 > 0 or srow.iva_5 > 0 or srow.base_exenta > 0):
                factor = min(Decimal("1"), monto_aplicado / tot_sale)
                grav_10 = (Decimal(str(srow.base_gravada_10 or 0)) * factor).quantize(Decimal("1"))
                grav_5 = (Decimal(str(srow.base_gravada_5 or 0)) * factor).quantize(Decimal("1"))
                exen = (Decimal(str(srow.base_exenta or 0)) * factor).quantize(Decimal("1"))
                iva_10 = (Decimal(str(srow.iva_10 or 0)) * factor).quantize(Decimal("1"))
                iva_5 = (Decimal(str(srow.iva_5 or 0)) * factor).quantize(Decimal("1"))
            else:
                iva_10 = (monto_aplicado / Decimal("11")).quantize(Decimal("1"))
                grav_10 = monto_aplicado - iva_10
                grav_5 = Decimal("0")
                iva_5 = Decimal("0")
                exen = Decimal("0")

            exp_id = uuid.uuid4()
            obs_nota = f"Recibo AR #{numero_recibo}. {data.observaciones or ''}".strip()
            desc_gasto = f"Consumo Interno - Factura {app['numero_documento']} ({customer_name})"

            await db.execute(
                text("""
                    INSERT INTO expenses (
                        id, company_id, branch_id, category_id, cost_center_id,
                        monto, descripcion, proveedor, ruc, timbrado, numero_factura,
                        tipo_comprobante, gravado_10, gravado_5, exentas, iva_10, iva_5,
                        tipo_pago, fecha_gasto, fecha_pago, estado, forma_pago_resumen,
                        notas, registrado_por, pagado_por, pagado_at, created_at
                    ) VALUES (
                        :id, :company_id, :branch_id, :category_id, :cost_center_id,
                        :monto, :descripcion, :proveedor, :ruc, :timbrado, :numero_factura,
                        'FACTURA_CONTADO', :gravado_10, :gravado_5, :exentas, :iva_10, :iva_5,
                        'compensacion_interna', :fecha_gasto, :fecha_pago, 'pagado', 'COMPENSACION_CONSUMO_INTERNO',
                        :notas, :user_id, :user_id, NOW(), NOW()
                    )
                """),
                {
                    "id": exp_id,
                    "company_id": company_id,
                    "branch_id": str(branch_id) if branch_id else None,
                    "category_id": cat_id_str,
                    "cost_center_id": cost_center_id_str,
                    "monto": float(monto_aplicado),
                    "descripcion": desc_gasto,
                    "proveedor": customer_name,
                    "ruc": customer_ruc,
                    "timbrado": timbrado,
                    "numero_factura": app["numero_documento"],
                    "gravado_10": float(grav_10),
                    "gravado_5": float(grav_5),
                    "exentas": float(exen),
                    "iva_10": float(iva_10),
                    "iva_5": float(iva_5),
                    "fecha_gasto": fecha_pago,
                    "fecha_pago": fecha_pago,
                    "notas": obs_nota,
                    "user_id": registrado_por,
                },
            )
    else:
        treasury_res = await _record_treasury_ingress(
            db=db,
            company_id=company_id,
            payment_id=payment_id,
            customer_id=str(data.customer_id),
            customer_name=customer_name,
            customer_ruc=customer_ruc,
            monto=monto_efectivo_recibido,
            data=data,
            registrado_por=registrado_por,
            numero_recibo=numero_recibo,
        )

    await _post_ar_payment_accounting(
        db=db,
        company_id=company_id,
        payment_id=payment_id,
        fecha=fecha_pago,
        numero_recibo=numero_recibo,
        customer_name=customer_name,
        monto_total=monto_entregado_gs,
        aplica_retencion=aplica_retencion,
        monto_retencion=monto_retencion,
        retencion_numero_comprobante=retencion_numero_comprobante,
        tipo_diferencia=tipo_diferencia,
        diferencia_monto=diferencia_monto,
        monto_facturas_canceladas=monto_facturas,
        forma_pago=data.forma_pago or "efectivo",
    )

    await db.flush()
    return {
        "payment_id": str(payment_id),
        "id": str(payment_id),
        "numero_recibo": numero_recibo,
        "monto_total": float(monto_entregado_gs),
        "monto_facturas_canceladas": float(monto_facturas),
        "diferencia_monto": float(diferencia_monto),
        "tipo_diferencia": tipo_diferencia,
        "aplica_retencion": aplica_retencion,
        "monto_retencion": float(monto_retencion),
        "monto_efectivo_recibido": float(monto_efectivo_recibido),
        "retencion_numero_comprobante": retencion_numero_comprobante,
        "documentos_afectados": len(aplicados),
        "allocations": aplicados,
        "treasury": treasury_res,
    }


async def compensate_internal_consumption(
    db: AsyncSession,
    company_id: str,
    data,
    registrado_por: str | None,
) -> dict:
    """Compensa facturas por cobrar por consumo interno de la empresa,
    cancelándolas e imputando el importe directamente al rubro de gastos."""
    ids = [str(i) for i in data.accounts_receivable_ids]
    q = await db.execute(
        text("""
            SELECT id, saldo_pendiente
            FROM accounts_receivable
            WHERE id = ANY(:ids) AND company_id = :company_id AND customer_id = :customer_id AND estado = 'pendiente' AND saldo_pendiente > 0
        """),
        {"ids": ids, "company_id": company_id, "customer_id": str(data.customer_id)},
    )
    rows = q.fetchall()
    if not rows:
        return {"error": "No se encontraron facturas pendientes válidas para compensar en el cliente seleccionado."}

    total_compensar = sum(Decimal(str(r.saldo_pendiente)) for r in rows)
    if total_compensar <= Decimal("0"):
        return {"error": "El total a compensar de las facturas seleccionadas es 0."}

    asuncion_today = datetime.now(ZoneInfo("America/Asuncion")).date()

    from api.src.accounts_receivable.schemas import ReceivableGlobalPaymentCreate

    global_data = ReceivableGlobalPaymentCreate(
        customer_id=data.customer_id,
        monto_total=total_compensar,
        monto_facturas_canceladas=total_compensar,
        forma_pago="compensacion_interna",
        destino_fondos="consumo_interno",
        fecha=data.fecha or asuncion_today,
        observaciones=data.observaciones or "Compensación Consumo Interno",
        category_id=data.category_id,
        cost_center_id=data.cost_center_id,
        accounts_receivable_ids=data.accounts_receivable_ids,
    )
    return await apply_global_payment(db, company_id, global_data, registrado_por)


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

    for cl in clientes_dict.values():
        cl["facturas"].sort(key=lambda f: (str(f.get("fecha_emision") or ""), str(f.get("numero_documento") or "")))

    clientes_list = sorted(clientes_dict.values(), key=lambda c: (c.get("customer_name") or "").upper().strip())

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
    """Trae toda la información de un pago registrado, el cliente, la empresa,
    las facturas amortizadas con sus montos imputados y saldos restantes,
    las Notas de Crédito (NC) aplicadas a esas facturas y el desglose de formas de pago."""
    q_pay = text("""
        SELECT
            rp.id, rp.company_id, rp.customer_id, rp.monto_total, rp.moneda,
            rp.forma_pago, rp.referencia, rp.fecha, rp.observaciones, rp.created_at,
            rp.numero_recibo,
            rp.aplica_retencion, rp.monto_retencion, rp.retencion_numero_comprobante,
            rp.retencion_fecha, rp.retencion_porcentaje, rp.monto_efectivo_recibido,
            rp.bank_account_id, rp.fecha_transferencia, rp.monto_transferencia, rp.monto_cheque, rp.referencia_transferencia,
            rp.monto_pyg, rp.monto_brl, rp.monto_usd, rp.tasa_brl, rp.tasa_usd,
            rp.cheque_id,
            ba.banco as banco_nombre, ba.numero_cuenta as banco_cuenta, ba.tipo as banco_tipo,
            c.razon_social as customer_name, c.nombre_fantasia, c.ruc as customer_ruc,
            c.telefono as customer_telefono, c.empresa_vinculada_nombre,
            comp.razon_social as comp_razon_social, comp.ruc as comp_ruc,
            comp.nombre_fantasia as comp_nombre_fantasia, comp.logo_url as comp_logo_url
        FROM receivable_payments rp
        LEFT JOIN customers c ON c.id = rp.customer_id
        LEFT JOIN companies comp ON comp.id = rp.company_id
        LEFT JOIN bank_accounts ba ON ba.id = rp.bank_account_id
        WHERE rp.id = :id
    """)
    r_pay = await db.execute(q_pay, {"id": payment_id})
    row = r_pay.fetchone()
    if not row:
        return None

    q_alloc = text("""
        SELECT
            rpa.id, rpa.monto, rpa.monto as monto_aplicado,
            ar.id as accounts_receivable_id, ar.sale_id,
            ar.numero_documento, ar.fecha_emision, ar.fecha_vencimiento,
            ar.monto_original, ar.saldo_pendiente, ar.estado, ar.notas_cobranza
        FROM receivable_payment_allocations rpa
        LEFT JOIN accounts_receivable ar ON ar.id = rpa.accounts_receivable_id
        WHERE rpa.receivable_payment_id = :payment_id
        ORDER BY ar.fecha_vencimiento ASC NULLS LAST, ar.fecha_emision ASC
    """)
    alloc_res = await db.execute(q_alloc, {"payment_id": payment_id})
    allocations = [dict(a._mapping) for a in alloc_res.fetchall()]

    # Buscar Notas de Crédito asociadas a las ventas de estas facturas
    sale_ids = [str(a["sale_id"]) for a in allocations if a.get("sale_id")]
    doc_nums = [str(a["numero_documento"]) for a in allocations if a.get("numero_documento")]

    ncs_by_sale: dict[str, list[dict]] = {}
    ncs_by_doc: dict[str, list[dict]] = {}
    all_ncs: list[dict] = []

    if sale_ids or doc_nums:
        q_nc = text("""
            SELECT
                nc.id, nc.numero, nc.total, nc.created_at, nc.motivo, nc.sale_id,
                nc.timbrado_numero, s.numero as factura_numero
            FROM notas_credito_debito nc
            JOIN sales s ON s.id = nc.sale_id
            WHERE (nc.sale_id = ANY(:sale_ids) OR s.numero = ANY(:doc_nums))
              AND nc.estado != 'anulado'
            ORDER BY nc.created_at ASC
        """)
        nc_res = await db.execute(q_nc, {"sale_ids": sale_ids, "doc_nums": doc_nums})
        for nc_row in nc_res.fetchall():
            nc_dict = dict(nc_row._mapping)
            nc_dict["total"] = float(nc_dict.get("total") or 0)
            all_ncs.append(nc_dict)
            s_id = str(nc_dict.get("sale_id") or "")
            f_num = str(nc_dict.get("factura_numero") or "")
            if s_id:
                ncs_by_sale.setdefault(s_id, []).append(nc_dict)
            if f_num:
                ncs_by_doc.setdefault(f_num, []).append(nc_dict)

    # Asociar NCs a cada allocation
    for a in allocations:
        s_id = str(a.get("sale_id") or "")
        f_num = str(a.get("numero_documento") or "")
        matched_ncs = ncs_by_sale.get(s_id) or ncs_by_doc.get(f_num) or []
        a["notas_credito"] = matched_ncs
        a["total_nc"] = sum(nc["total"] for nc in matched_ncs)

    # Buscar cheques vinculados
    chq_list: list[dict] = []
    cheque_id_val = getattr(row, "cheque_id", None)
    if cheque_id_val:
        q_chq = text("""
            SELECT id, numero, banco_emisor, librador_nombre, librador_documento, monto, fecha_emision, fecha_pago, diferido
            FROM cheques
            WHERE receivable_payment_id = :payment_id OR id = :chq_id
        """)
        chq_res = await db.execute(q_chq, {"payment_id": payment_id, "chq_id": str(cheque_id_val)})
    else:
        q_chq = text("""
            SELECT id, numero, banco_emisor, librador_nombre, librador_documento, monto, fecha_emision, fecha_pago, diferido
            FROM cheques
            WHERE receivable_payment_id = :payment_id
        """)
        chq_res = await db.execute(q_chq, {"payment_id": payment_id})
    for ch_r in chq_res.fetchall():
        c_dict = dict(ch_r._mapping)
        c_dict["monto"] = float(c_dict.get("monto") or 0)
        chq_list.append(c_dict)

    pay_dict = dict(row._mapping)
    pay_dict["allocations"] = allocations
    pay_dict["notas_credito"] = all_ncs
    pay_dict["total_notas_credito"] = sum(nc["total"] for nc in all_ncs)
    pay_dict["total_facturas_original"] = sum(float(a.get("monto_original") or 0) for a in allocations)
    pay_dict["cheques"] = chq_list

    # Desglose de formas de pago percibidas
    formas_pago_detalle = []
    monto_pyg = float(pay_dict.get("monto_pyg") or 0)
    monto_brl = float(pay_dict.get("monto_brl") or 0)
    monto_usd = float(pay_dict.get("monto_usd") or 0)
    tasa_brl = float(pay_dict.get("tasa_brl") or 1)
    tasa_usd = float(pay_dict.get("tasa_usd") or 1)
    monto_transf = float(pay_dict.get("monto_transferencia") or 0)
    monto_chq = float(pay_dict.get("monto_cheque") or 0)

    if monto_pyg > 0:
        formas_pago_detalle.append({
            "tipo": "efectivo_pyg",
            "descripcion": "Efectivo Guaraníes",
            "moneda": "PYG",
            "monto": monto_pyg,
            "monto_gs": monto_pyg,
        })
    if monto_brl > 0:
        monto_gs_brl = round(monto_brl * tasa_brl)
        formas_pago_detalle.append({
            "tipo": "efectivo_brl",
            "descripcion": f"Efectivo Reales (R$ {monto_brl:,.2f} a cotiz. {tasa_brl:,.0f})",
            "moneda": "BRL",
            "monto": monto_brl,
            "tasa": tasa_brl,
            "monto_gs": monto_gs_brl,
        })
    if monto_usd > 0:
        monto_gs_usd = round(monto_usd * tasa_usd)
        formas_pago_detalle.append({
            "tipo": "efectivo_usd",
            "descripcion": f"Efectivo Dólares (US$ {monto_usd:,.2f} a cotiz. {tasa_usd:,.0f})",
            "moneda": "USD",
            "monto": monto_usd,
            "tasa": tasa_usd,
            "monto_gs": monto_gs_usd,
        })
    if monto_transf > 0:
        info_parts = []
        if pay_dict.get("banco_nombre"):
            info_parts.append(str(pay_dict["banco_nombre"]))
        if pay_dict.get("banco_cuenta"):
            info_parts.append(f"Cta: {pay_dict['banco_cuenta']}")
        f_tr = pay_dict.get("fecha_transferencia")
        if f_tr:
            f_str = f_tr.strftime("%d/%m/%Y") if hasattr(f_tr, "strftime") else str(f_tr)
            info_parts.append(f"Fecha op: {f_str}")
        ref_val = pay_dict.get("referencia_transferencia") or pay_dict.get("referencia")
        if ref_val:
            info_parts.append(f"Ref: {ref_val}")
        desc_tr = "Transferencia Bancaria"
        if info_parts:
            desc_tr += f" ({' · '.join(info_parts)})"
        formas_pago_detalle.append({
            "tipo": "transferencia",
            "descripcion": desc_tr,
            "moneda": "PYG",
            "monto": monto_transf,
            "monto_gs": monto_transf,
            "banco": pay_dict.get("banco_nombre"),
            "cuenta": pay_dict.get("banco_cuenta"),
            "fecha": str(pay_dict.get("fecha_transferencia") or ""),
            "referencia": ref_val,
        })
    if monto_chq > 0 or len(chq_list) > 0:
        info_ch = []
        for ch in chq_list:
            info_ch.append(f"N° {ch['numero']} ({ch.get('banco_emisor') or 'Banco'})")
        desc_ch = "Cheque"
        if info_ch:
            desc_ch += f" ({', '.join(info_ch)})"
        formas_pago_detalle.append({
            "tipo": "cheque",
            "descripcion": desc_ch,
            "moneda": "PYG",
            "monto": monto_chq or sum(c["monto"] for c in chq_list),
            "monto_gs": monto_chq or sum(c["monto"] for c in chq_list),
            "cheques": chq_list,
        })

    # Si fue efectivo tradicional o no se desglosó por monedas
    if not formas_pago_detalle:
        forma_label = (pay_dict.get("forma_pago") or "Efectivo").replace("_", " ").upper()
        if pay_dict.get("referencia"):
            forma_label += f" (Ref: {pay_dict['referencia']})"
        formas_pago_detalle.append({
            "tipo": pay_dict.get("forma_pago") or "efectivo",
            "descripcion": forma_label,
            "moneda": pay_dict.get("moneda") or "PYG",
            "monto": float(pay_dict.get("monto_total") or 0),
            "monto_gs": float(pay_dict.get("monto_total") or 0),
        })

    # Retención IVA si aplica
    if pay_dict.get("aplica_retencion") and float(pay_dict.get("monto_retencion") or 0) > 0:
        ret_parts = ["Retención Tesakã"]
        if pay_dict.get("retencion_numero_comprobante"):
            ret_parts.append(f"N° {pay_dict['retencion_numero_comprobante']}")
        ret_fec = pay_dict.get("retencion_fecha")
        if ret_fec:
            ret_fec_str = ret_fec.strftime("%d/%m/%Y") if hasattr(ret_fec, "strftime") else str(ret_fec)
            ret_parts.append(ret_fec_str)
        formas_pago_detalle.append({
            "tipo": "retencion_iva",
            "descripcion": " · ".join(ret_parts),
            "moneda": "PYG",
            "monto": float(pay_dict["monto_retencion"]),
            "monto_gs": float(pay_dict["monto_retencion"]),
        })

    pay_dict["formas_pago_detalle"] = formas_pago_detalle

    rec_fallback = f"REC-{row.fecha.strftime('%Y%m%d') if row.fecha else '20260910'}-{str(abs(hash(str(payment_id))))[:4]}"
    pay_dict["numero_recibo"] = getattr(row, "numero_recibo", None) or rec_fallback
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


async def get_corporate_agreement_pending_docs(
    db: AsyncSession,
    company_id: str,
    empresa_nombre: str,
    fecha_corte: date | None = None,
    doc_ids: list[str] | None = None,
    tipo_destino: str | None = "personal",
) -> dict:
    """Trae los funcionarios de una empresa vinculada y sus facturas pendientes
    que aún no fueron incluidas en ninguna remisión de corte mensual,
    opcionalmente filtrando por fecha_corte (inclusive), tipo_destino ('personal', 'empresa', 'todos') o lista específica de comprobantes."""
    try:
        cid = uuid.UUID(str(company_id))
    except (ValueError, TypeError, AttributeError):
        return {"empresa_nombre": empresa_nombre, "total_saldo": 0, "total_documentos": 0, "total_funcionarios": 0, "items": []}

    params: dict = {"company_id": cid, "empresa_nombre": f"%{empresa_nombre.strip()}%"}
    extra_clauses = []
    if fecha_corte is not None:
        extra_clauses.append("DATE(ar.fecha_emision AT TIME ZONE 'America/Asuncion') <= :fecha_corte")
        params["fecha_corte"] = fecha_corte
    if doc_ids:
        extra_clauses.append("ar.id = ANY(:doc_ids)")
        params["doc_ids"] = [str(x) for x in doc_ids]

    if tipo_destino == "personal":
        extra_clauses.append("(c.tipo_persona != 'juridica' AND c.razon_social NOT ILIKE :empresa_exacta)")
        params["empresa_exacta"] = empresa_nombre.strip()
    elif tipo_destino == "empresa":
        extra_clauses.append("(c.tipo_persona = 'juridica' OR c.razon_social ILIKE :empresa_exacta)")
        params["empresa_exacta"] = empresa_nombre.strip()

    extra_sql = ("\n          AND " + "\n          AND ".join(extra_clauses)) if extra_clauses else ""

    query = text(f"""
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
          AND ar.corporate_remission_id IS NULL{extra_sql}
        ORDER BY COALESCE(c.razon_social, 'Funcionario') ASC, ar.fecha_vencimiento ASC NULLS LAST, ar.fecha_emision ASC
    """)
    result = await db.execute(query, params)
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

    for fn in funcionarios_dict.values():
        fn["documentos"].sort(key=lambda d: (str(d.get("fecha_emision") or ""), str(d.get("numero_documento") or "")))

    funcionarios_list = sorted(funcionarios_dict.values(), key=lambda f: (f.get("customer_name") or f.get("customer_nombre") or "").upper().strip())
    return {
        "empresa_vinculada_nombre": empresa_nombre,
        "fecha_corte": fecha_corte.isoformat() if fecha_corte else None,
        "total_deuda": float(total_deuda),
        "total_documentos": total_documentos,
        "cantidad_documentos": total_documentos,
        "total_funcionarios": len(funcionarios_list),
        "cantidad_funcionarios": len(funcionarios_list),
        "funcionarios": funcionarios_list,
    }


async def create_corporate_remission(db: AsyncSession, company_id: str, data, user_id: str | None) -> dict:
    """Ejecuta el Corte y Remisión a la Empresa Vinculada:
    1. Agrupa los comprobantes no remitidos (con filtro por fecha_corte o selección específica).
    2. Crea el registro consolidado ar_corporate_remissions.
    3. Pasa los comprobantes a 'REMITIDO_EMPRESA' vinculándolos a la remisión.
    4. REHABILITA INMEDIATAMENTE la línea de crédito a los funcionarios descontando su credito_usado
       (la deuda pasó a ser responsabilidad de la empresa empleadora)."""
    empresa_nombre = data.empresa_vinculada_nombre.strip()
    periodo_mes = data.periodo_mes.strip()
    fecha_corte = data.fecha_corte or date.today()
    fecha_remision = date.today()
    tipo_destino = getattr(data, "tipo_destino", "personal") or "personal"

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
        extra_filter = ""
        if tipo_destino == "personal":
            extra_filter = "AND (c.tipo_persona != 'juridica' AND c.razon_social NOT ILIKE :empresa_exacta)"
        elif tipo_destino == "empresa":
            extra_filter = "AND (c.tipo_persona = 'juridica' OR c.razon_social ILIKE :empresa_exacta)"

        q_docs = text(f"""
            SELECT ar.id, ar.customer_id, ar.saldo_pendiente, c.empresa_vinculada_ruc
            FROM accounts_receivable ar
            JOIN customers c ON c.id = ar.customer_id
            WHERE ar.company_id = :company_id AND TRIM(c.empresa_vinculada_nombre) ILIKE :empresa
              AND ar.estado = 'pendiente' AND ar.corporate_remission_id IS NULL
              AND DATE(ar.fecha_emision AT TIME ZONE 'America/Asuncion') <= :fecha_corte
              {extra_filter}
        """)
        r_docs = await db.execute(q_docs, {
            "company_id": company_id,
            "empresa": f"%{empresa_nombre}%",
            "empresa_exacta": empresa_nombre,
            "fecha_corte": fecha_corte,
        })

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
                ar.monto_original, ar.saldo_pendiente, ar.tipo, ar.estado, ar.notas_cobranza,
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
    import re
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
        if rem_dict.get("estado") == "PAGADO":
            # Si ya se canceló, el saldo_pendiente en BD quedó en 0.
            # Calculamos el importe neto efectivamente liquidado restando Notas de Crédito / devoluciones
            neto = float(d.monto_original or 0)
            if getattr(d, "notas_cobranza", None):
                matches = re.findall(r"-₲\s*([0-9\.,]+)", d.notas_cobranza)
                for m in matches:
                    clean_m = m.replace(".", "").replace(",", ".")
                    try:
                        neto -= float(clean_m)
                    except Exception:
                        pass
            s = max(0.0, neto)
        else:
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

    for fn in funcionarios_dict.values():
        fn["documentos"].sort(key=lambda d: (str(d.get("fecha_emision") or ""), str(d.get("numero_documento") or "")))

    rem_dict["funcionarios"] = sorted(
        funcionarios_dict.values(),
        key=lambda fn: (fn.get("customer_name") or "").upper().strip(),
    )
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
    elif forma_pago == "cheque":
        cheque_id = uuid.uuid4()
        chq_f_emision = getattr(data, "fecha_cheque_emision", None) or getattr(data, "fecha_pago", None) or date.today()
        chq_f_cobro = getattr(data, "fecha_cheque_cobro", None) or chq_f_emision
        es_diferido = bool(getattr(data, "es_cheque_diferido", False) or (chq_f_cobro and chq_f_emision and chq_f_cobro > chq_f_emision))
        chq_numero = getattr(data, "numero_cheque", None) or getattr(data, "referencia", None) or f"CHQ-{rem.numero_remision}"
        chq_banco = getattr(data, "banco_cheque", None) or "Banco"
        chq_librador = getattr(data, "titular_cheque", None) or empresa_nombre
        uid = uuid.UUID(str(user_id)) if user_id else None

        await db.execute(
            text("""
                INSERT INTO cheques
                    (id, company_id, numero, banco_emisor, beneficiario, librador_nombre, librador_documento,
                     monto, moneda, fecha_emision, fecha_pago, diferido, estado, tipo_cheque,
                     customer_id, concepto, notas, created_by, created_at, updated_at)
                VALUES
                    (:id, :company_id, :numero, :banco, 'Extra Supermercado Mayorista', :librador, :ruc,
                     :monto, 'PYG', :f_emision, :f_pago, :diferido, 'en_cartera', 'recibido',
                     :customer_id, :concepto, :notas, :user_id, NOW(), NOW())
            """),
            {
                "id": cheque_id,
                "company_id": company_id,
                "numero": chq_numero,
                "banco": chq_banco,
                "librador": chq_librador,
                "ruc": getattr(rem, "empresa_vinculada_ruc", None),
                "monto": float(monto_pago),
                "f_emision": chq_f_emision,
                "f_pago": chq_f_cobro,
                "diferido": es_diferido,
                "customer_id": getattr(rem, "empresa_customer_id", None),
                "concepto": f"Cobro Remisión {rem.numero_remision} - {empresa_nombre}",
                "notas": getattr(data, "notas", None),
                "user_id": uid,
            },
        )
        await db.execute(
            text("""
                INSERT INTO cheque_historial
                    (id, cheque_id, estado_anterior, estado_nuevo, user_id, user_nombre, notas, created_at)
                VALUES
                    (gen_random_uuid(), :cheque_id, NULL, 'en_cartera', :user_id, 'Sistema (Cobranzas)', :notas, NOW())
            """),
            {
                "cheque_id": cheque_id,
                "user_id": uid,
                "notas": f"Cheque {'diferido' if es_diferido else 'al día'} recibido de {empresa_nombre} por remisión {rem.numero_remision}",
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


async def revert_corporate_remission_payment(
    db: AsyncSession, company_id: str, remission_id: str, motivo: str | None, user_id: str | None
) -> dict:
    """Revierte de forma atómica y consistente el pago registrado para una remisión corporativa:
    1. Descuenta los fondos indebidamente acreditados en la cuenta bancaria de Banco/Bóveda.
    2. Elimina la transacción bancaria / anula cheque recibido.
    3. Restablece los comprobantes asociados a estado 'REMITIDO_EMPRESA' y con su saldo adeudado real.
    4. Restablece el saldo pendiente de la remisión a su monto original y su estado a 'REMITIDO'."""
    r_res = await db.execute(
        text("SELECT * FROM ar_corporate_remissions WHERE id = :id AND company_id = :cid"),
        {"id": remission_id, "cid": company_id},
    )
    rem = r_res.fetchone()
    if not rem:
        return {"error": "Remisión corporativa no encontrada"}

    if rem.estado not in ("PAGADO", "PAGADO_PARCIAL"):
        return {"error": f"La remisión se encuentra en estado '{rem.estado}'. Solo se pueden revertir pagos de remisiones en estado PAGADO o PAGADO_PARCIAL."}

    # 1. Revertir transacciones bancarias asociadas
    bt_res = await db.execute(
        text("""
            SELECT id, bank_account_id, monto
            FROM bank_transactions
            WHERE company_id = :cid
              AND categoria = 'cobranzas_corporativas'
              AND (descripcion ILIKE :desc_rem OR referencia ILIKE :ref_rem)
        """),
        {"cid": company_id, "desc_rem": f"%{rem.numero_remision}%", "ref_rem": f"%{rem.numero_remision}%"}
    )
    bts = bt_res.fetchall()
    for bt in bts:
        if bt.bank_account_id and bt.monto:
            await db.execute(
                text("UPDATE bank_accounts SET saldo_actual = saldo_actual - :monto, updated_at = NOW() WHERE id = :id"),
                {"monto": float(bt.monto), "id": str(bt.bank_account_id)}
            )
        await db.execute(
            text("DELETE FROM bank_transactions WHERE id = :id"),
            {"id": bt.id}
        )

    # 2. Revertir entradas en bóveda
    ve_res = await db.execute(
        text("""
            SELECT id
            FROM vault_entries
            WHERE company_id = :cid
              AND origen = 'cobranza_ar'
              AND observaciones ILIKE :obs_rem
        """),
        {"cid": company_id, "obs_rem": f"%{rem.numero_remision}%"}
    )
    ves = ve_res.fetchall()
    for ve in ves:
        await db.execute(
            text("DELETE FROM vault_entries WHERE id = :id"),
            {"id": ve.id}
        )

    # 3. Anular cheques recibidos
    chq_res = await db.execute(
        text("""
            SELECT id
            FROM cheques
            WHERE company_id = :cid
              AND concepto ILIKE :con_rem
        """),
        {"cid": company_id, "con_rem": f"%{rem.numero_remision}%"}
    )
    chqs = chq_res.fetchall()
    for chq in chqs:
        await db.execute(
            text("UPDATE cheques SET estado = 'anulado', updated_at = NOW() WHERE id = :id"),
            {"id": chq.id}
        )

    # 4. Restaurar comprobantes de la remisión a REMITIDO_EMPRESA con su saldo pendiente neto real
    docs_res = await db.execute(
        text("SELECT id, monto_original, notas_cobranza FROM accounts_receivable WHERE corporate_remission_id = :rem_id"),
        {"rem_id": remission_id}
    )
    docs = docs_res.fetchall()
    import re
    for d in docs:
        saldo = Decimal(str(d.monto_original or 0))
        if getattr(d, "notas_cobranza", None):
            matches = re.findall(r"-₲\s*([0-9\.,]+)", d.notas_cobranza)
            for m in matches:
                clean_m = m.replace(".", "").replace(",", ".")
                try:
                    saldo -= Decimal(clean_m)
                except Exception:
                    pass
        saldo = max(Decimal("0"), saldo)
        await db.execute(
            text("""
                UPDATE accounts_receivable
                SET estado = 'REMITIDO_EMPRESA',
                    saldo_pendiente = :saldo,
                    ultimo_pago = NULL,
                    updated_at = NOW()
                WHERE id = :id
            """),
            {"saldo": float(saldo), "id": d.id}
        )

    # 5. Restaurar la remisión a estado REMITIDO
    motivo_clean = (motivo or "").strip() or "Reversión efectuada por operador"
    nota_adjunta = f"\n[PAGO REVERTIDO el {date.today().isoformat()}: {motivo_clean}]"
    await db.execute(
        text("""
            UPDATE ar_corporate_remissions
            SET saldo_pendiente = monto_total,
                estado = 'REMITIDO',
                fecha_recepcion = NULL,
                notas = COALESCE(notas, '') || :nota,
                updated_at = NOW()
            WHERE id = :id
        """),
        {"nota": nota_adjunta, "id": remission_id}
    )

    await db.flush()
    return {
        "remission_id": str(remission_id),
        "numero_remision": rem.numero_remision,
        "estado": "REMITIDO",
        "saldo_pendiente": float(rem.monto_total),
        "message": f"Pago de remisión {rem.numero_remision} revertido exitosamente. Los comprobantes vuelven a estar pendientes de cobro a la empresa."
    }


async def cancel_corporate_remission(
    db: AsyncSession, company_id: str, remission_id: str, motivo: str | None, user_id: str | None
) -> dict:
    """Anula por completo una remisión corporativa que aún no tiene cobros activos (o cuyos cobros fueron revertidos):
    1. Desvincula todos los comprobantes (corporate_remission_id = NULL) y los devuelve a estado 'pendiente'.
    2. Restablece la deuda en la cuenta corriente personal de cada funcionario (saldo_utilizado).
    3. Marca la remisión como 'ANULADO' para mantener trazabilidad histórica."""
    r_res = await db.execute(
        text("SELECT * FROM ar_corporate_remissions WHERE id = :id AND company_id = :cid"),
        {"id": remission_id, "cid": company_id},
    )
    rem = r_res.fetchone()
    if not rem:
        return {"error": "Remisión corporativa no encontrada"}

    if rem.estado in ("PAGADO", "PAGADO_PARCIAL"):
        return {"error": "No se puede anular una remisión con pagos registrados. Revierta el pago primero."}

    docs_res = await db.execute(
        text("""
            SELECT ar.id, ar.customer_id, ar.monto_original, ar.notas_cobranza
            FROM accounts_receivable ar
            WHERE ar.corporate_remission_id = :rem_id
        """),
        {"rem_id": remission_id}
    )
    docs = docs_res.fetchall()

    funcionarios_montos = {}
    import re
    for d in docs:
        cid = str(d.customer_id)
        saldo = Decimal(str(d.monto_original or 0))
        if getattr(d, "notas_cobranza", None):
            matches = re.findall(r"-₲\s*([0-9\.,]+)", d.notas_cobranza)
            for m in matches:
                clean_m = m.replace(".", "").replace(",", ".")
                try:
                    saldo -= Decimal(clean_m)
                except Exception:
                    pass
        saldo = max(Decimal("0"), saldo)
        funcionarios_montos[cid] = funcionarios_montos.get(cid, Decimal("0")) + saldo

        await db.execute(
            text("""
                UPDATE accounts_receivable
                SET corporate_remission_id = NULL,
                    remitido_empresa_at = NULL,
                    estado = 'pendiente',
                    saldo_pendiente = :saldo,
                    updated_at = NOW()
                WHERE id = :id
            """),
            {"saldo": float(saldo), "id": d.id}
        )

    for cid, monto in funcionarios_montos.items():
        await db.execute(
            text("""
                UPDATE credit_accounts
                SET saldo_utilizado = saldo_utilizado + :monto,
                    saldo_disponible = GREATEST(0, saldo_disponible - :monto),
                    updated_at = NOW()
                WHERE company_id = :company_id AND customer_id = :customer_id
            """),
            {"monto": float(monto), "company_id": company_id, "customer_id": cid}
        )
        await db.execute(
            text("""
                UPDATE customers
                SET credito_usado = credito_usado + :monto
                WHERE id = :customer_id
            """),
            {"monto": float(monto), "customer_id": cid}
        )

    motivo_clean = (motivo or "").strip() or "Anulada por operador"
    nota_adjunta = f"\n[REMISIÓN ANULADA el {date.today().isoformat()}: {motivo_clean}]"
    await db.execute(
        text("""
            UPDATE ar_corporate_remissions
            SET estado = 'ANULADO',
                saldo_pendiente = 0,
                notas = COALESCE(notas, '') || :nota,
                updated_at = NOW()
            WHERE id = :id
        """),
        {"nota": nota_adjunta, "id": remission_id}
    )

    await db.flush()
    return {
        "remission_id": str(remission_id),
        "numero_remision": rem.numero_remision,
        "estado": "ANULADO",
        "message": f"Remisión {rem.numero_remision} anulada exitosamente. Los comprobantes quedaron nuevamente disponibles para corte."
    }


# ── Política de Bloqueo por Mora en Crédito / Extra Club ───────────────────────
_CREDIT_BLOCKING_POLICY_KEY = "ar_credit_blocking_policy"


async def get_credit_blocking_policy(db: AsyncSession, company_id: str) -> dict:
    """Retorna la política configurada para la empresa sobre bloqueo por mora en ventas a crédito/Extra Club.
    Por defecto, bloqueo_mora_activo = False (no restringe por antigüedad de facturas),
    y dias_mora_limite = 60 días."""
    try:
        result = await db.execute(
            text("SELECT value FROM settings_company WHERE company_id = :cid AND key = :k"),
            {"cid": company_id, "k": _CREDIT_BLOCKING_POLICY_KEY},
        )
        row = result.fetchone()
        if row and row.value:
            data = json.loads(row.value)
            return {
                "bloqueo_mora_activo": bool(data.get("bloqueo_mora_activo", False)),
                "dias_mora_limite": max(1, int(data.get("dias_mora_limite", 60))),
            }
    except Exception as e:
        logger.warning("No se pudo leer settings_company para ar_credit_blocking_policy: %s", e)
    return {"bloqueo_mora_activo": False, "dias_mora_limite": 60}


async def update_credit_blocking_policy(db: AsyncSession, company_id: str, data: any) -> dict:
    """Actualiza la política de bloqueo por mora para la empresa en settings_company."""
    if isinstance(data, dict):
        bloqueo_activo = bool(data.get("bloqueo_mora_activo", False))
        dias_limite = max(1, int(data.get("dias_mora_limite", 60)))
    else:
        bloqueo_activo = bool(getattr(data, "bloqueo_mora_activo", False))
        dias_limite = max(1, int(getattr(data, "dias_mora_limite", 60)))

    payload = {"bloqueo_mora_activo": bloqueo_activo, "dias_mora_limite": dias_limite}
    val = json.dumps(payload)
    await db.execute(
        text("""
            INSERT INTO settings_company (id, company_id, key, value, created_at, updated_at)
            VALUES (gen_random_uuid(), :cid, :k, :v, now(), now())
            ON CONFLICT (company_id, key) DO UPDATE SET value = :v, updated_at = now()
        """),
        {"cid": company_id, "k": _CREDIT_BLOCKING_POLICY_KEY, "v": val},
    )
    await db.commit()
    return payload



