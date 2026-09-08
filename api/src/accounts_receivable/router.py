from __future__ import annotations
from datetime import date
import os
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from api.src.db import get_db
from api.src.accounts_receivable import service
from api.src.accounts_receivable import export_service as ar_export_service
from api.src.accounts_receivable import pdf_reports as ar_pdf_reports
from api.src.accounts_receivable.schemas import (
    ReceivablePaymentCreate,
    ReceivableGlobalPaymentCreate,
    CorporateRemissionCreate,
    CorporateRemissionPayInput,
)
from api.src.integrated_finance import pdf_reports
from api.src.auth.middleware import require_auth

router = APIRouter(prefix="/api/v1", tags=["accounts-receivable"])


async def _get_company_info(db: AsyncSession, company_id: str) -> dict:
    r = await db.execute(
        text("SELECT razon_social, ruc, logo_url, nombre_fantasia, direccion, ciudad FROM companies WHERE id = :cid"),
        {"cid": company_id}
    )
    row = r.first()
    return {
        "razon_social": (row.razon_social if row and row.razon_social else None) or "GRUPO SANTA TERESA E.A.S.",
        "ruc": (row.ruc if row and row.ruc else None) or "80150377-9",
        "logo_url": row.logo_url if row else None,
        "nombre_fantasia": getattr(row, "nombre_fantasia", None) or "Extra Supermercado Mayorista",
        "direccion": getattr(row, "direccion", None) or "Alejo Garcia esq. Carlos Antonio López",
        "ciudad": getattr(row, "ciudad", None) or "Pedro Juan Caballero",
    }



@router.get("/companies/{company_id}/accounts-receivable")
async def list_receivables(
    company_id: str,
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_accounts_receivable(db, company_id, customer_id, estado, search, limit, offset)


@router.get("/companies/{company_id}/accounts-receivable/count")
async def count_receivables(
    company_id: str,
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return {"total": await service.count_accounts_receivable(db, company_id, customer_id, estado)}


@router.get("/companies/{company_id}/accounts-receivable/aging")
async def aging_report(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_aging_report(db, company_id)


@router.get("/companies/{company_id}/accounts-receivable/empresas-vinculadas")
async def search_empresas_vinculadas(company_id: str, search: str = Query(..., min_length=1), db: AsyncSession = Depends(get_db)):
    """Typeahead de empresas vinculadas (customers.empresa_vinculada_nombre) para
    el filtro del reporte de aging -- sin esto el usuario tiene que adivinar el
    nombre exacto en un campo de texto libre."""
    return await service.search_empresas_vinculadas(db, company_id, search)


# ── Reportes exportables (Aging y Cobranzas), Excel + PDF, con rango de fechas ──

@router.get("/companies/{company_id}/accounts-receivable/export/aging.xlsx")
async def export_aging_xlsx(
    company_id: str, fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None),
    customer_id: str | None = Query(None), empresa_vinculada: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    aging = await service.get_aging_for_report(db, company_id, fecha_desde, fecha_hasta, customer_id, empresa_vinculada)
    xlsx = ar_export_service.export_aging_excel(aging, fecha_desde, fecha_hasta)
    return StreamingResponse(
        iter([xlsx]), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=aging_cuentas_por_cobrar.xlsx"},
    )


@router.get("/companies/{company_id}/accounts-receivable/export/aging.pdf")
async def export_aging_pdf(
    company_id: str, fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None),
    customer_id: str | None = Query(None), empresa_vinculada: str | None = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    aging = await service.get_aging_for_report(db, company_id, fecha_desde, fecha_hasta, customer_id, empresa_vinculada)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = ar_pdf_reports.generate_aging_report_pdf(company, aging, fecha_desde, fecha_hasta, generated_by)
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=aging_cuentas_por_cobrar.pdf", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/companies/{company_id}/accounts-receivable/export/cobranzas.xlsx")
async def export_cobranzas_xlsx(
    company_id: str, fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    payments = await service.list_payments_period(db, company_id, fecha_desde, fecha_hasta)
    xlsx = ar_export_service.export_cobranzas_excel(payments, fecha_desde, fecha_hasta)
    return StreamingResponse(
        iter([xlsx]), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=cobranzas.xlsx"},
    )


@router.get("/companies/{company_id}/accounts-receivable/export/cobranzas.pdf")
async def export_cobranzas_pdf(
    company_id: str, fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    payments = await service.list_payments_period(db, company_id, fecha_desde, fecha_hasta)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = ar_pdf_reports.generate_cobranzas_report_pdf(company, payments, fecha_desde, fecha_hasta, generated_by)
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=cobranzas.pdf", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/companies/{company_id}/accounts-receivable/summary")
async def receivable_summary(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_receivable_summary(db, company_id)


@router.get("/companies/{company_id}/accounts-receivable/customers/{customer_id}/pending")
async def customer_pending_documents(company_id: str, customer_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_customer_pending_documents(db, company_id, customer_id)


@router.get("/companies/{company_id}/accounts-receivable/customers/{customer_id}/payments")
async def customer_payment_history(company_id: str, customer_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_payments_for_customer(db, company_id, customer_id)


@router.get("/accounts-receivable/{receivable_id}/payments")
async def document_payment_history(receivable_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_payments_for_document(db, receivable_id)


@router.post("/companies/{company_id}/accounts-receivable/payments")
async def register_payment(company_id: str, body: ReceivablePaymentCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.create_receivable_payment(db, company_id, body, user.get("id"))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/companies/{company_id}/accounts-receivable/customers/{customer_id}/statement.pdf")
async def customer_statement_pdf(company_id: str, customer_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    cust_r = await db.execute(text("SELECT razon_social, ruc FROM customers WHERE id = :id"), {"id": customer_id})
    cust = cust_r.first()
    if not cust:
        raise HTTPException(404, "Cliente no encontrado")

    docs_r = await db.execute(
        text("""
            SELECT numero_documento, fecha_emision, fecha_vencimiento, monto_original, saldo_pendiente, dias_mora
            FROM accounts_receivable
            WHERE company_id = :cid AND customer_id = :cust_id AND estado = 'pendiente'
            ORDER BY fecha_vencimiento
        """),
        {"cid": company_id, "cust_id": customer_id},
    )
    documentos = [
        {
            "numero": r.numero_documento or "-",
            "fecha_emision": r.fecha_emision.strftime("%d/%m/%Y") if r.fecha_emision else "-",
            "fecha_vencimiento": r.fecha_vencimiento.strftime("%d/%m/%Y") if r.fecha_vencimiento else "-",
            "monto_original": float(r.monto_original or 0),
            "saldo_pendiente": float(r.saldo_pendiente or 0),
            "dias_mora": r.dias_mora,
        }
        for r in docs_r.all()
    ]

    comp_r = await db.execute(text("SELECT razon_social, ruc, logo_url FROM companies WHERE id = :cid"), {"cid": company_id})
    comp = comp_r.first()
    company = {"razon_social": comp.razon_social, "ruc": comp.ruc, "logo_url": comp.logo_url} if comp else {"razon_social": "Empresa", "ruc": "N/A"}
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"

    pdf_bytes = pdf_reports.generate_account_statement_pdf(
        company, {"nombre": cust.razon_social, "ruc": cust.ruc}, "cliente", documentos, generated_by
    )
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=estado_cuenta_{customer_id[:8]}.pdf",
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ── Reporte Detallado de Deuda por Cliente en PDF ──────────────────────

@router.get("/companies/{company_id}/accounts-receivable/export/deuda-detallada.pdf")
async def export_deuda_detallada_pdf(
    company_id: str,
    customer_id: str | None = Query(None),
    empresa_vinculada: str | None = Query(None),
    solo_con_saldo: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Genera el reporte detallado de cuentas por cobrar en PDF con la nueva estética
    institucional (idéntica a Arqueo de Caja), con logo de Extra Supermercado,
    KPI cards, desglose por cliente y detalle completo de facturas."""
    data = await service.get_deuda_detallada_data(
        db, company_id, customer_id=customer_id, empresa_vinculada=empresa_vinculada, solo_con_saldo=solo_con_saldo
    )
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"

    # Obtener nombre del cliente para el subtítulo si vino customer_id
    filtro_cliente_nombre = None
    if customer_id and data.get("clientes"):
        filtro_cliente_nombre = data["clientes"][0].get("customer_name")

    pdf_bytes = ar_pdf_reports.generate_deuda_detallada_pdf(
        company,
        data,
        filtro_empresa=empresa_vinculada,
        filtro_cliente=filtro_cliente_nombre,
        generated_by=generated_by,
    )
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=deuda_detallada_cuentas_por_cobrar.pdf",
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ── Cobro Global en Cascada FIFO ───────────────────────────────────────

@router.post("/companies/{company_id}/accounts-receivable/payments/apply-global")
async def apply_global_payment_endpoint(
    company_id: str,
    body: ReceivableGlobalPaymentCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Aplica un pago global en cascada FIFO a las facturas del cliente
    (a las más antiguas primero, y si hay remanente a las más nuevas).
    Permite tanto pagos de contado como pagos parciales o sobre un lote seleccionado."""
    result = await service.apply_global_payment(db, company_id, body, user.get("id"))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Recibo de Cobro en Formato A6 Horizontal con QR ───────────────────

@router.get("/companies/{company_id}/accounts-receivable/payments/{payment_id}/receipt.pdf")
async def export_payment_receipt_pdf(
    company_id: str,
    payment_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Genera el Recibo de Cobranza Oficial en A6 horizontal (148mm x 105mm) con logo,
    imputación de facturas, monto en letras y números, firmas y código QR."""
    receipt_data = await service.get_payment_receipt_data(db, payment_id)
    if not receipt_data:
        raise HTTPException(status_code=404, detail="Recibo de pago no encontrado")

    company = await _get_company_info(db, company_id)

    # Determinar URL base pública para el QR (prioriza dominio oficial intelimarket.superextra.com.py)
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    forwarded_proto = request.headers.get("x-forwarded-proto", "https")
    if forwarded_host and "superextra.com.py" in forwarded_host:
        base_url = f"{forwarded_proto}://{forwarded_host}"
    else:
        base_url = os.getenv("PUBLIC_APP_URL", "https://intelimarket.superextra.com.py")

    pdf_bytes = ar_pdf_reports.generate_recibo_a6_pdf(company, receipt_data, verification_base_url=base_url)

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=recibo_{receipt_data.get('numero_recibo', payment_id[:8])}.pdf",
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ── Verificación Pública de Recibo (QR Scan) ──────────────────────────

@router.get("/accounts-receivable/receipts/{payment_id}/verify")
async def verify_payment_receipt(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Endpoint PÚBLICO para escanear el QR del recibo físico A6. No requiere autenticación.
    Devuelve los datos de validación oficial del cobro, cliente, importes e imputaciones."""
    data = await service.get_payment_receipt_data(db, payment_id)
    if not data:
        raise HTTPException(status_code=404, detail="Recibo de cobro no encontrado o inválido.")

    created_at = data.get("created_at")
    fecha_hora_str = ""
    if created_at and hasattr(created_at, "astimezone"):
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=ar_pdf_reports.ZoneInfo("UTC"))
        fecha_hora_str = created_at.astimezone(ar_pdf_reports.PY_TZ).strftime("%d/%m/%Y %H:%M")

    return {
        "valido": True,
        "payment_id": str(data["id"]),
        "numero_recibo": data.get("numero_recibo"),
        "fecha": str(data.get("fecha")),
        "fecha_hora": fecha_hora_str,
        "monto_total": float(data.get("monto_total") or 0),
        "moneda": data.get("moneda") or "PYG",
        "forma_pago": data.get("forma_pago") or "efectivo",
        "referencia": data.get("referencia"),
        "observaciones": data.get("observaciones"),
        "cliente": {
            "razon_social": data.get("customer_name") or data.get("nombre_fantasia") or "Cliente",
            "ruc": data.get("customer_ruc") or "—",
            "telefono": data.get("customer_telefono") or "—",
            "empresa_vinculada": data.get("empresa_vinculada_nombre"),
        },
        "empresa": {
            "razon_social": data.get("comp_razon_social") or "GRUPO SANTA TERESA E.A.S.",
            "nombre_fantasia": data.get("comp_nombre_fantasia") or "Extra Supermercado Mayorista",
            "ruc": data.get("comp_ruc") or "80150377-9",
        },
        "allocations": [
            {
                "numero_documento": a.get("numero_documento") or "S/N",
                "fecha_vencimiento": str(a.get("fecha_vencimiento")) if a.get("fecha_vencimiento") else None,
                "monto_original": float(a.get("monto_original") or 0),
                "monto_aplicado": float(a.get("monto") or 0),
                "saldo_pendiente": float(a.get("saldo_pendiente") or 0),
                "estado": a.get("estado"),
            }
            for a in data.get("allocations", [])
        ],
    }


# ── Convenios de Empresas Vinculadas (Extra Club) y Remisiones Corporativas ────

@router.get("/companies/{company_id}/accounts-receivable/corporate-agreements/summary")
async def corporate_agreements_summary(company_id: str, db: AsyncSession = Depends(get_db)):
    """Resumen consolidado de todas las empresas vinculadas con funcionarios socios Extra Club."""
    return await service.get_corporate_agreements_summary(db, company_id)


@router.get("/companies/{company_id}/accounts-receivable/corporate-agreements/{empresa_nombre}/pending-docs")
async def corporate_agreement_pending_docs(company_id: str, empresa_nombre: str, db: AsyncSession = Depends(get_db)):
    """Documentos y funcionarios pendientes de corte mensual para una empresa vinculada."""
    return await service.get_corporate_agreement_pending_docs(db, company_id, empresa_nombre)


@router.get("/companies/{company_id}/accounts-receivable/corporate-agreements/{empresa_nombre}/extractos.pdf")
async def export_corporate_agreement_extractos_pdf(
    company_id: str,
    empresa_nombre: str,
    periodo: str = Query(..., description="Período de corte, ej. 2026-09"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Genera el cuadernillo masivo en PDF con todos los extractos individuales por funcionario
    de la empresa vinculada, cada uno en una página separada y con talón de conformidad de descuento."""
    data = await service.get_corporate_agreement_pending_docs(db, company_id, empresa_nombre)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"

    pdf_bytes = ar_pdf_reports.generate_extractos_empresa_pdf(
        company=company,
        empresa_nombre=empresa_nombre,
        periodo=periodo,
        funcionarios_data=data.get("funcionarios", []),
        generated_by=generated_by,
    )
    safe_name = empresa_nombre.replace(" ", "_").lower()
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=extractos_{safe_name}_{periodo}.pdf",
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@router.post("/companies/{company_id}/accounts-receivable/corporate-agreements/remit")
async def create_corporate_remission_endpoint(
    company_id: str,
    body: CorporateRemissionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Ejecuta el Corte y Remisión a la Empresa Vinculada:
    Crea la remisión corporativa, actualiza las facturas a REMITIDO_EMPRESA, y rehabilita
    inmediatamente la línea de crédito de cada funcionario."""
    result = await service.create_corporate_remission(db, company_id, body, user.get("id"))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/companies/{company_id}/accounts-receivable/corporate-remissions")
async def list_corporate_remissions(
    company_id: str,
    empresa_nombre: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Lista las remisiones corporativas emitidas a empresas vinculadas."""
    return await service.get_corporate_remissions_list(db, company_id, empresa_nombre)


@router.get("/companies/{company_id}/accounts-receivable/corporate-remissions/{remission_id}")
async def get_corporate_remission_detail(
    company_id: str,
    remission_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Detalle de una remisión corporativa, con desglose de funcionarios y vales incluidos."""
    rem = await service.get_corporate_remission_detail(db, remission_id)
    if not rem:
        raise HTTPException(status_code=404, detail="Remisión corporativa no encontrada")
    return rem


@router.get("/companies/{company_id}/accounts-receivable/corporate-remissions/{remission_id}/pdf")
async def export_corporate_remission_pdf(
    company_id: str,
    remission_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Genera el PDF del Resumen Consolidado de Remisión a la Empresa Vinculada,
    con tabla de nómina a retener y Acta de Entrega y Recepción para firma y sello de RRHH."""
    rem = await service.get_corporate_remission_detail(db, remission_id)
    if not rem:
        raise HTTPException(status_code=404, detail="Remisión corporativa no encontrada")

    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"

    pdf_bytes = ar_pdf_reports.generate_remision_consolidada_pdf(company, rem, generated_by)
    safe_num = (rem.get("numero_remision") or remission_id[:8]).replace("/", "_")
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=remision_{safe_num}.pdf",
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@router.post("/companies/{company_id}/accounts-receivable/corporate-remissions/{remission_id}/pay")
async def pay_corporate_remission_endpoint(
    company_id: str,
    remission_id: str,
    body: CorporateRemissionPayInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Registra el pago efectuado por la empresa vinculada (parcial o total).
    Impacta en la tesorería (Banco/Bóveda/Cheque) y salda las facturas sin tocar el crédito de los empleados."""
    result = await service.pay_corporate_remission(db, company_id, remission_id, body, user.get("id"))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


