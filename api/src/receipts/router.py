from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.receipts.pdf_service import generate_receipt_pdf
from api.src.sifen.qr_service import generate_qr_image

router = APIRouter(prefix="/api/v1/receipts", tags=["receipts"])


@router.get("/sales/{sale_id}/pdf")
async def get_sale_receipt_pdf(
    sale_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(text("""
            SELECT s.id, s.customer_id, s.total, s.iva_10, s.iva_5,
                   s.tipo_comprobante, s.condicion, s.numero, s.cdc,
                   s.created_at, c.razon_social, c.ruc, c.direccion, c.telefono,
                   cu.razon_social as customer_name, cu.ruc as customer_ruc
            FROM sales s
            LEFT JOIN companies c ON s.company_id = c.id
            LEFT JOIN customers cu ON s.customer_id = cu.id
            WHERE s.id = :sale_id
        """), {"sale_id": sale_id})
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Venta no encontrada")

        items_result = await db.execute(text("""
            SELECT si.cantidad, si.precio_unitario, p.nombre as product_name, p.iva_tasa
            FROM sale_items si
            LEFT JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = :sale_id
        """), {"sale_id": sale_id})
        items = [dict(row._mapping) for row in items_result.fetchall()]

        company = {
            "razon_social": row.razon_social or "Empresa",
            "ruc": row.ruc or "N/A",
            "direccion": row.direccion or "",
            "telefono": row.telefono or "",
        }

        sale = {
            "numero": row.numero or "N/A",
            "tipo_comprobante": row.tipo_comprobante or "factura",
            "condicion": row.condicion or "contado",
            "total": row.total or 0,
            "iva_10": row.iva_10 or 0,
            "iva_5": row.iva_5 or 0,
            "customer_name": row.customer_name or "Consumidor Final",
            "customer_ruc": row.customer_ruc or "N/A",
            "created_at": row.created_at.isoformat() if row.created_at else "",
        }

        cdc = row.cdc
        qr_bytes = None
        if cdc:
            qr_bytes = generate_qr_image(cdc, size=256)

        pdf_bytes = generate_receipt_pdf(company, sale, items, cdc, qr_bytes)

        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=factura_{sale_id[:8]}.pdf",
                "Content-Length": str(len(pdf_bytes)),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")
