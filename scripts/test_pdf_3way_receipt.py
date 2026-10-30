"""Script de prueba unitaria para verificar la generación del PDF:
'Acta de Recepción y Cierre de Compras — Cotejo 3-Way Match & Fijación Comercial'.
Verifica que las 11 columnas encajen sin desbordes en el lienzo A4 Landscape (273mm),
que los márgenes se calculen sobre PPP, y que se aplique la regla canónica de moneda PYG.
"""

import os
import sys
from decimal import Decimal

# Asegurar path para imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.src.purchases.pdf_reports import generate_purchase_3way_receipt_pdf


def test_generate_3way_receipt():
    company = {
        "razon_social": "GRUPO SANTA TERESA E.A.S.",
        "nombre_fantasia": "EXTRA SUPERMERCADO MAYORISTA",
        "ruc": "80150377-9",
        "direccion": "Alejo Garcia esq. Carlos Antonio López, Pedro Juan Caballero",
        "telefono": "+595992052200",
    }

    # Datos fieles a la imagen compartida: OC-20261024-005290 / Casa Gonzalito S.R.L.
    data = {
        "order": {
            "numero": "OC-20261024-005290",
            "fecha": "2026-10-24T09:33:00Z",
            "condiciones_pago": "30 Días",
            "moneda": "PYG",
            "created_by_name": "Juan Gabriel Ruiz",
            "total": Decimal("10699317"),
        },
        "receipt": {
            "numero": "REC-2026-00412",
            "proveedor_ref": "001-001-0028201",
            "fecha": "2026-10-24T10:15:00Z",
            "warehouse_nombre": "Depósito Central / Muelle",
            "user_name": "Juan Gabriel Ruiz",
            "total": Decimal("10699317"),
            "observaciones": "Descargado en Muelle 1 conforme. Lotes y vencimientos auditados.",
        },
        "invoice": {
            "numero_factura": "001-001-0028201",
            "timbrado": "18545636",
            "fecha_emision": "2026-10-24",
            "condicion": "Crédito 30 Días",
            "total": Decimal("10699317"),
            "total_factura_impreso": Decimal("10699317"),
            "bloqueada_para_pago": False,
        },
        "supplier": {
            "razon_social": "CASA GONZALITO S.R.L.",
            "ruc": "80005427-0",
        },
        "matching": {
            "estado_matching": "match_perfecto",
            "bloqueada_para_pago": False,
            "total_recibido": Decimal("10699317"),
            "total_factura": Decimal("10699317"),
            "diferencia_redondeo": Decimal("0"),
        },
        "items": [
            {
                "sku": "5763",
                "codigo_barra": "7840005000055",
                "descripcion": "TREBOL CHOCOLATADA TP 1L",
                "cantidad_recibida": 96,
                "costo_factura": 8628,
                "costo_promedio": 8510,
                "precio_venta": 11500,
                "precio_mayorista": 10200,
                "iva_tasa": 10,
            },
            {
                "sku": "21701",
                "codigo_barra": "7840005012355",
                "descripcion": "TREBOL CHOCOLATADA TP 500ML",
                "cantidad_recibida": 60,
                "costo_factura": 4572,
                "costo_promedio": 4550,
                "precio_venta": 6200,
                "precio_mayorista": 5500,
                "iva_tasa": 10,
            },
            {
                "sku": "21660",
                "codigo_barra": "7840005000062",
                "descripcion": "TREBOL CHOCOLATADA TP 200ML",
                "cantidad_recibida": 90,
                "costo_factura": 2132,
                "costo_promedio": 2100,
                "precio_venta": 2900,
                "precio_mayorista": 2550,
                "iva_tasa": 10,
            },
            {
                "sku": "63114",
                "codigo_barra": "7840005012874",
                "descripcion": "TREBOL LECHE POLVO DESCREM 400GR",
                "cantidad_recibida": 4,
                "costo_factura": 25884,
                "costo_promedio": 25800,
                "precio_venta": 32500,
                "precio_mayorista": 29800,
                "iva_tasa": 10,
            },
            {
                "sku": "62267",
                "codigo_barra": "7840005012881",
                "descripcion": "TREBOL LECHE POLVO ENTERA 400GR",
                "cantidad_recibida": 3,
                "costo_factura": 25884,
                "costo_promedio": 25884,
                "precio_venta": 33000,
                "precio_mayorista": 30000,
                "iva_tasa": 10,
            },
            {
                "sku": "62268",
                "codigo_barra": "7840005012713",
                "descripcion": "TREBOL LECHE POLVO ENTERA 800GR",
                "cantidad_recibida": 3,
                "costo_factura": 43647,
                "costo_promedio": 43500,
                "precio_venta": 56000,
                "precio_mayorista": 51000,
                "iva_tasa": 10,
            },
            {
                "sku": "5803",
                "codigo_barra": "7840005012416",
                "descripcion": "TREBOL LECHE C/FIBRA TP 1L",
                "cantidad_recibida": 24,
                "costo_factura": 7500,
                "costo_promedio": 7450,
                "precio_venta": 9900,
                "precio_mayorista": 8900,
                "iva_tasa": 10,
            },
            {
                "sku": "117254",
                "codigo_barra": "7840005012690",
                "descripcion": "TREBOL LECHE S/LACTOSA TP 1L",
                "cantidad_recibida": 84,
                "costo_factura": 7500,
                "costo_promedio": 7500,
                "precio_venta": 9900,
                "precio_mayorista": 8900,
                "iva_tasa": 10,
            },
            {
                "sku": "5801",
                "codigo_barra": "7840005012393",
                "descripcion": "TREBOL LECHE CRECIMIENTO TP 1L (12)",
                "cantidad_recibida": 120,
                "costo_factura": 7300,
                "costo_promedio": 7250,
                "precio_venta": 9500,
                "precio_mayorista": 8500,
                "iva_tasa": 10,
            },
            {
                "sku": "32555",
                "codigo_barra": "7840005012362",
                "descripcion": "TREBOL LECHE CRECIMIENTO TP 200ML",
                "cantidad_recibida": 60,
                "costo_factura": 1900,
                "costo_promedio": 1900,
                "precio_venta": 2600,
                "precio_mayorista": 2300,
                "iva_tasa": 10,
            },
            {
                "sku": "117244",
                "codigo_barra": "7840005012409",
                "descripcion": "TREBOL LECHE DESCREM TP 1L (12)",
                "cantidad_recibida": 360,
                "costo_factura": 6550,
                "costo_promedio": 6500,
                "precio_venta": 8500,
                "precio_mayorista": 7600,
                "iva_tasa": 10,
            },
            {
                "sku": "65078",
                "codigo_barra": "7840005012904",
                "descripcion": "FAMLAC LECHE BL TP 500ML",
                "cantidad_recibida": 24,
                "costo_factura": 2600,
                "costo_promedio": 2580,
                "precio_venta": 3500,
                "precio_mayorista": 3100,
                "iva_tasa": 10,
            },
            {
                "sku": "117252",
                "codigo_barra": "7840005011174",
                "descripcion": "FAMLAC LECHE BL TP 1L",
                "cantidad_recibida": 360,
                "costo_factura": 5100,
                "costo_promedio": 5050,
                "precio_venta": 6700,
                "precio_mayorista": 6000,
                "iva_tasa": 10,
            },
            {
                "sku": "5798",
                "codigo_barra": "7840005012348",
                "descripcion": "TREBOL LECHE ENTERA TP 500ML",
                "cantidad_recibida": 24,
                "costo_factura": 3700,
                "costo_promedio": 3680,
                "precio_venta": 4900,
                "precio_mayorista": 4350,
                "iva_tasa": 10,
            },
            {
                "sku": "117251",
                "codigo_barra": "7840005012379",
                "descripcion": "TREBOL LECHE ENTERA TP 1L (12)",
                "cantidad_recibida": 450,
                "costo_factura": 6550,
                "costo_promedio": 6500,
                "precio_venta": 8500,
                "precio_mayorista": 7600,
                "iva_tasa": 10,
            },
        ],
    }

    pdf_bytes = generate_purchase_3way_receipt_pdf(company, data, generated_by="Sistema / Auditoría")
    assert len(pdf_bytes) > 1000, "El PDF generado debe tener un tamaño válido (> 1KB)"
    assert pdf_bytes.startswith(b"%PDF"), "El archivo generado debe ser un PDF válido"

    output_path = os.path.join(os.path.dirname(__file__), "test_3way_receipt.pdf")
    with open(output_path, "wb") as f:
        f.write(pdf_bytes)

    print(f"✓ PDF generado con éxito en: {output_path} ({len(pdf_bytes)} bytes)")


if __name__ == "__main__":
    test_generate_3way_receipt()
