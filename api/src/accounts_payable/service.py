import uuid
from datetime import date
from typing import Dict, Any, List, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_accounts_payable(
    db: AsyncSession,
    company_id: str,
    supplier_id: Optional[str] = None,
    estado: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {
        "company_id": company_id,
        "today": date.today(),
        "limit": limit,
        "offset": offset,
    }

    where_clauses = ["inv.company_id = :company_id"]

    if supplier_id:
        where_clauses.append("inv.supplier_id = :supplier_id")
        params["supplier_id"] = supplier_id

    if estado and estado != "todos":
        if estado == "vencido":
            where_clauses.append("inv.saldo_pendiente > 0 AND inv.fecha_vencimiento < :today")
        elif estado == "pendiente":
            where_clauses.append("inv.saldo_pendiente > 0")
        elif estado in ("pagado", "pagada"):
            where_clauses.append("(inv.estado IN ('pagado', 'pagada') OR inv.saldo_pendiente = 0)")
        else:
            where_clauses.append("inv.estado = :estado")
            params["estado"] = estado

    if search:
        where_clauses.append("(inv.numero_factura ILIKE :search OR s.razon_social ILIKE :search OR s.ruc ILIKE :search)")
        params["search"] = f"%{search}%"

    where_stmt = " AND ".join(where_clauses)

    query = text(f"""
        SELECT 
            inv.id, inv.company_id, inv.supplier_id, s.razon_social as supplier_name, s.ruc as supplier_ruc,
            inv.numero_factura, inv.timbrado, inv.cdc, inv.fecha_emision, inv.fecha_vencimiento, inv.moneda,
            inv.total as monto_original, inv.saldo_pendiente, inv.condicion, inv.estado, inv.concepto,
            CASE 
                WHEN inv.fecha_vencimiento IS NULL THEN 0 
                WHEN inv.fecha_vencimiento < :today THEN (:today - inv.fecha_vencimiento)::int 
                ELSE 0 
            END as dias_mora
        FROM supplier_invoices inv
        LEFT JOIN suppliers s ON s.id = inv.supplier_id
        WHERE {where_stmt}
        ORDER BY inv.saldo_pendiente DESC, inv.fecha_vencimiento ASC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)

    res = await db.execute(query, params)
    rows = res.fetchall()
    return [dict(r._mapping) for r in rows]


async def get_ap_aging_report(db: AsyncSession, company_id: str) -> Dict[str, Any]:
    params = {"company_id": company_id, "today": date.today()}

    # Buckets calculation
    query_buckets = text("""
        SELECT 
            SUM(saldo_pendiente) as total_pendiente,
            COUNT(id) as cantidad_documentos,
            SUM(CASE WHEN fecha_vencimiento >= :today OR fecha_vencimiento IS NULL THEN saldo_pendiente ELSE 0 END) as al_dia,
            COUNT(CASE WHEN fecha_vencimiento >= :today OR fecha_vencimiento IS NULL THEN id END) as cant_al_dia,
            
            SUM(CASE WHEN fecha_vencimiento < :today AND (:today - fecha_vencimiento) BETWEEN 1 AND 30 THEN saldo_pendiente ELSE 0 END) as days_1_30,
            COUNT(CASE WHEN fecha_vencimiento < :today AND (:today - fecha_vencimiento) BETWEEN 1 AND 30 THEN id END) as cant_1_30,
            
            SUM(CASE WHEN fecha_vencimiento < :today AND (:today - fecha_vencimiento) BETWEEN 31 AND 60 THEN saldo_pendiente ELSE 0 END) as days_31_60,
            COUNT(CASE WHEN fecha_vencimiento < :today AND (:today - fecha_vencimiento) BETWEEN 31 AND 60 THEN id END) as cant_31_60,
            
            SUM(CASE WHEN fecha_vencimiento < :today AND (:today - fecha_vencimiento) BETWEEN 61 AND 90 THEN saldo_pendiente ELSE 0 END) as days_61_90,
            COUNT(CASE WHEN fecha_vencimiento < :today AND (:today - fecha_vencimiento) BETWEEN 61 AND 90 THEN id END) as cant_61_90,
            
            SUM(CASE WHEN fecha_vencimiento < :today AND (:today - fecha_vencimiento) > 90 THEN saldo_pendiente ELSE 0 END) as days_91_plus,
            COUNT(CASE WHEN fecha_vencimiento < :today AND (:today - fecha_vencimiento) > 90 THEN id END) as cant_91_plus
        FROM supplier_invoices
        WHERE company_id = :company_id AND saldo_pendiente > 0 
    """)

    res = await db.execute(query_buckets, params)
    b = res.fetchone()

    total_pend = float(b.total_pendiente or 0)
    cant_docs = int(b.cantidad_documentos or 0)

    def calc_pct(val):
        return round((float(val or 0) / total_pend * 100), 2) if total_pend > 0 else 0.0

    buckets = [
        {"rango": "Al día", "monto": float(b.al_dia or 0), "cantidad": int(b.cant_al_dia or 0), "porcentaje": calc_pct(b.al_dia)},
        {"rango": "1-30 días", "monto": float(b.days_1_30 or 0), "cantidad": int(b.cant_1_30 or 0), "porcentaje": calc_pct(b.days_1_30)},
        {"rango": "31-60 días", "monto": float(b.days_31_60 or 0), "cantidad": int(b.cant_31_60 or 0), "porcentaje": calc_pct(b.days_31_60)},
        {"rango": "61-90 días", "monto": float(b.days_61_90 or 0), "cantidad": int(b.cant_61_90 or 0), "porcentaje": calc_pct(b.days_61_90)},
        {"rango": "+90 días", "monto": float(b.days_91_plus or 0), "cantidad": int(b.cant_91_plus or 0), "porcentaje": calc_pct(b.days_91_plus)},
    ]

    # Supplier Breakdown
    query_suppliers = text("""
        SELECT 
            inv.supplier_id,
            s.razon_social as supplier_name,
            SUM(inv.saldo_pendiente) as saldo_total,
            COUNT(inv.id) as total_documentos,
            SUM(CASE WHEN inv.fecha_vencimiento >= :today OR inv.fecha_vencimiento IS NULL THEN inv.saldo_pendiente ELSE 0 END) as current,
            SUM(CASE WHEN inv.fecha_vencimiento < :today AND (:today - inv.fecha_vencimiento) BETWEEN 1 AND 30 THEN inv.saldo_pendiente ELSE 0 END) as days_1_30,
            SUM(CASE WHEN inv.fecha_vencimiento < :today AND (:today - inv.fecha_vencimiento) BETWEEN 31 AND 60 THEN inv.saldo_pendiente ELSE 0 END) as days_31_60,
            SUM(CASE WHEN inv.fecha_vencimiento < :today AND (:today - inv.fecha_vencimiento) BETWEEN 61 AND 90 THEN inv.saldo_pendiente ELSE 0 END) as days_61_90,
            SUM(CASE WHEN inv.fecha_vencimiento < :today AND (:today - inv.fecha_vencimiento) > 90 THEN inv.saldo_pendiente ELSE 0 END) as days_91_plus
        FROM supplier_invoices inv
        LEFT JOIN suppliers s ON s.id = inv.supplier_id
        WHERE inv.company_id = :company_id AND inv.saldo_pendiente > 0 
        GROUP BY inv.supplier_id, s.razon_social
        ORDER BY saldo_total DESC
        LIMIT 100
    """)

    res_supp = await db.execute(query_suppliers, params)
    suppliers = [dict(r._mapping) for r in res_supp.fetchall()]

    return {
        "total_pendiente": total_pend,
        "cantidad_documentos": cant_docs,
        "buckets": buckets,
        "por_proveedores": suppliers,
    }


async def get_ap_summary(db: AsyncSession, company_id: str) -> Dict[str, Any]:
    params = {"company_id": company_id, "today": date.today()}

    query = text("""
        SELECT 
            COUNT(id) as total,
            SUM(total) as monto_total_historico,
            SUM(saldo_pendiente) as total_pendiente,
            COUNT(CASE WHEN estado IN ('pagado', 'pagada') OR saldo_pendiente = 0 THEN id END) as pagados,
            COUNT(CASE WHEN saldo_pendiente > 0 THEN id END) as pendientes,
            COUNT(CASE WHEN saldo_pendiente > 0 AND fecha_vencimiento < :today THEN id END) as vencidos,
            SUM(CASE WHEN saldo_pendiente > 0 AND fecha_vencimiento < :today THEN saldo_pendiente ELSE 0 END) as monto_vencido
        FROM supplier_invoices
        WHERE company_id = :company_id
    """)

    res = await db.execute(query, params)
    r = res.fetchone()

    return {
        "total": int(r.total or 0),
        "monto_total_historico": float(r.monto_total_historico or 0),
        "total_pendiente": float(r.total_pendiente or 0),
        "pagados": int(r.pagados or 0),
        "pendientes": int(r.pendientes or 0),
        "vencidos": int(r.vencidos or 0),
        "monto_vencido": float(r.monto_vencido or 0),
    }


async def get_ap_document_detail(db: AsyncSession, company_id: str, document_id: str) -> Dict[str, Any]:
    query = text("""
        SELECT 
            inv.id, inv.company_id, inv.supplier_id, s.razon_social as supplier_name, s.ruc as supplier_ruc, s.direccion as supplier_direccion,
            inv.numero_factura, inv.timbrado, inv.cdc, inv.fecha_emision, inv.fecha_vencimiento, inv.moneda,
            inv.total as monto_original, inv.saldo_pendiente, inv.condicion, inv.estado, inv.concepto, inv.notas,
            CASE WHEN inv.fecha_vencimiento IS NULL THEN 0 ELSE (:today - inv.fecha_vencimiento)::int END as dias_mora
        FROM supplier_invoices inv
        LEFT JOIN suppliers s ON s.id = inv.supplier_id
        WHERE inv.id = :doc_id AND inv.company_id = :company_id
    """)

    res = await db.execute(query, {"doc_id": document_id, "company_id": company_id, "today": date.today()})
    doc = res.fetchone()
    if not doc:
        return {}

    doc_dict = dict(doc._mapping)
    items = [{
        "id": str(doc.id),
        "descripcion": f"Factura Proveedor {doc.numero_factura or 'Legacy'} - {doc.concepto or 'Mercaderías Insumos'}",
        "cantidad": 1,
        "precio_unitario": float(doc.monto_original),
        "iva_tasa": 10,
        "iva_monto": round(float(doc.monto_original) * 0.1),
        "total": float(doc.monto_original)
    }]

    doc_dict["items"] = items
    return doc_dict


async def create_ap_payment_order(db: AsyncSession, company_id: str, data: dict) -> dict:
    invoice_ids = data.get("invoice_ids", [])
    monto_pagado = float(data.get("monto_pagado", 0))
    medio_pago = data.get("medio_pago", "transferencia")
    referencia = data.get("referencia", "")
    observaciones = data.get("observaciones", "")

    order_no = f"OP-2026-{uuid.uuid4().hex[:6].upper()}"
    monto_restante = monto_pagado
    facturas_aplicadas = []

    for inv_id in invoice_ids:
        if monto_restante <= 0:
            break
        q = text("SELECT id, saldo_pendiente, total FROM supplier_invoices WHERE id = :id AND company_id = :cid")
        res = await db.execute(q, {"id": inv_id, "cid": company_id})
        inv = res.fetchone()
        if not inv:
            continue

        saldo_actual = float(inv.saldo_pendiente)
        pago_aplicado = min(monto_restante, saldo_actual)
        nuevo_saldo = saldo_actual - pago_aplicado
        nuevo_estado = "pagado" if nuevo_saldo <= 0 else "pendiente"

        await db.execute(text("""
            UPDATE supplier_invoices 
            SET saldo_pendiente = :nuevo_saldo, estado = :nuevo_estado, updated_at = NOW()
            WHERE id = :id
        """), {"id": inv_id, "nuevo_saldo": nuevo_saldo, "nuevo_estado": nuevo_estado})

        monto_restante -= pago_aplicado
        facturas_aplicadas.append({"id": inv_id, "monto_aplicado": pago_aplicado, "nuevo_saldo": nuevo_saldo})

    await db.commit()
    return {
        "success": True,
        "payment_order_number": order_no,
        "monto_total_pagado": monto_pagado,
        "medio_pago": medio_pago,
        "referencia": referencia,
        "facturas_aplicadas": facturas_aplicadas
    }
