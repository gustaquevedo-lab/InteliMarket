"""Import service for bulk data upload"""

import csv
import io
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.products.models import Product
from api.src.customers.models import Customer
from api.src.imports.schemas import ImportResult, ImportRow


async def import_products(
    db: AsyncSession,
    company_id: str,
    file_content: bytes,
    file_format: str = "csv",
    delimiter: str = ";",
) -> ImportResult:
    content = file_content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    
    rows = list(reader)
    total = len(rows)
    success = 0
    errors = 0
    warnings = 0
    details = []

    for idx, row in enumerate(rows, start=2):
        try:
            sku = row.get("sku", "").strip()
            nombre = row.get("nombre", "").strip()
            codigo_barra = row.get("codigo_barra", "").strip() or None
            descripcion = row.get("descripcion", "").strip() or None
            unidad_medida = row.get("unidad_medida", "unidad").strip()
            iva_tasa = float(row.get("iva_tasa", "10").replace(",", "."))
            stock_minimo = float(row.get("stock_minimo", "0").replace(",", "."))
            category_id = row.get("category_id", "").strip() or None
            
            if not sku or not nombre:
                errors += 1
                details.append(ImportRow(
                    row=idx,
                    status="error",
                    message="sku y nombre son obligatorios",
                    data=row,
                ))
                continue

            product = Product(
                company_id=company_id,
                sku=sku,
                nombre=nombre,
                codigo_barra=codigo_barra,
                descripcion=descripcion,
                unidad_medida=unidad_medida,
                iva_tasa=iva_tasa,
                stock_minimo=stock_minimo,
                activo=True,
            )
            db.add(product)
            success += 1
            details.append(ImportRow(
                row=idx,
                status="success",
                message=f"Producto '{nombre}' creado",
                data={"sku": sku, "nombre": nombre},
            ))
        except Exception as e:
            errors += 1
            details.append(ImportRow(
                row=idx,
                status="error",
                message=str(e),
                data=row,
            ))

    await db.commit()

    return ImportResult(
        total_rows=total,
        success=success,
        errors=errors,
        warnings=warnings,
        details=details,
    )


async def import_customers(
    db: AsyncSession,
    company_id: str,
    file_content: bytes,
    file_format: str = "csv",
    delimiter: str = ";",
) -> ImportResult:
    content = file_content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    
    rows = list(reader)
    total = len(rows)
    success = 0
    errors = 0
    warnings = 0
    details = []

    for idx, row in enumerate(rows, start=2):
        try:
            razon_social = row.get("razon_social", "").strip()
            ruc = row.get("ruc", "").strip() or None
            ci = row.get("ci", "").strip() or None
            tipo_persona = row.get("tipo_persona", "fisica").strip()
            direccion = row.get("direccion", "").strip() or None
            ciudad = row.get("ciudad", "").strip() or None
            telefono = row.get("telefono", "").strip() or None
            email = row.get("email", "").strip() or None
            credito_limite = float(row.get("credito_limite", "0").replace(",", "."))
            
            if not razon_social:
                errors += 1
                details.append(ImportRow(
                    row=idx,
                    status="error",
                    message="razon_social es obligatorio",
                    data=row,
                ))
                continue

            customer = Customer(
                company_id=company_id,
                razon_social=razon_social,
                ruc=ruc,
                ci=ci,
                tipo_persona=tipo_persona,
                direccion=direccion,
                ciudad=ciudad,
                telefono=telefono,
                email=email,
                credito_limite=credito_limite,
                credito_usado=0,
                activo=True,
            )
            db.add(customer)
            success += 1
            details.append(ImportRow(
                row=idx,
                status="success",
                message=f"Cliente '{razon_social}' creado",
                data={"razon_social": razon_social},
            ))
        except Exception as e:
            errors += 1
            details.append(ImportRow(
                row=idx,
                status="error",
                message=str(e),
                data=row,
            ))

    await db.commit()

    return ImportResult(
        total_rows=total,
        success=success,
        errors=errors,
        warnings=warnings,
        details=details,
    )


async def preview_file(
    file_content: bytes,
    delimiter: str = ";",
    max_rows: int = 10,
) -> dict:
    content = file_content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    rows = []
    headers = reader.fieldnames or []
    
    for idx, row in enumerate(reader):
        if idx >= max_rows:
            break
        rows.append(dict(row))
    
    all_rows = list(csv.DictReader(io.StringIO(content), delimiter=delimiter))
    
    return {
        "headers": headers,
        "rows": rows,
        "total_rows": len(all_rows),
    }
