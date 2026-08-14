from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.sifen.client import sifen_client

router = APIRouter(prefix="/api/v1/receipts", tags=["receipts"])


@router.get("/sales/{sale_id}/pdf")
async def get_sale_receipt_pdf(
    sale_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(text("""
            SELECT s.id, s.customer_id, s.total, s.subtotal, s.iva_10, s.iva_5,
                   s.tipo_comprobante, s.condicion, s.numero, s.cdc, s.sifen_estado,
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
        items = [dict(r._mapping) for r in items_result.fetchall()]

        company_dict = {
            "razon_social": row.razon_social or "Casa Gonzalito",
            "ruc": row.ruc or "N/A",
            "direccion": row.direccion or "Asuncion",
            "telefono": row.telefono or "",
        }

        customer_dict = {
            "razon_social": row.customer_name or "CONSUMIDOR FINAL",
            "ruc": row.customer_ruc or "00000000",
        }

        sale_dict = {
            "id": str(row.id),
            "numero": row.numero or "N/A",
            "tipo_comprobante": row.tipo_comprobante or "factura",
            "condicion": row.condicion or "contado",
            "subtotal": float(row.subtotal or row.total or 0),
            "descuento": 0,
            "total": float(row.total or 0),
            "total_iva10": float(row.iva_10 or 0),
            "total_iva5": float(row.iva_5 or 0),
            "cdc": row.cdc or "",
            "fecha": row.created_at.isoformat() if row.created_at else "",
            "items": [
                {
                    "descripcion": i.get("product_name") or "Producto",
                    "cantidad": float(i.get("cantidad") or 1),
                    "precio_unitario": float(i.get("precio_unitario") or 0),
                }
                for i in items
            ],
        }

        pdf_bytes = await sifen_client.generate_pdf(sale_dict, company_dict, customer_dict)

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=factura_{row.numero or sale_id[:8]}.pdf",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF con InteliFact: {str(e)}")
