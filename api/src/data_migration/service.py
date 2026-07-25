"""Data migration service — preview and import from Excel/CSV"""

import csv
import io
import json
import tempfile
import os
from uuid import UUID
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.products.models import Product, ProductCategory
from api.src.customers.models import Customer
from api.src.purchases.models import Supplier
from api.src.sales.models import Sale, SaleItem
from api.src.credit_accounts.models import CreditAccount, CreditMovement
from api.src.data_migration.models import MigrationLog


DETECT_HEADERS = {
    "productos": {"producto", "nombre", "sku", "codigo", "precio", "costo", "categoria", "stock"},
    "clientes": {"nombre", "razon_social", "ruc", "ci", "email", "telefono", "direccion"},
    "proveedores": {"razon_social", "proveedor", "ruc", "email", "telefono", "direccion"},
    "ventas": {"fecha", "cliente", "producto", "cantidad", "precio", "total"},
    "saldos": {"cliente", "saldo", "limite", "deuda"},
}


def _detect_tipo(headers: list[str]) -> str:
    header_lower = {h.lower().strip() for h in headers}
    best_match = "productos"
    best_score = 0
    for tipo, keywords in DETECT_HEADERS.items():
        score = len(header_lower & keywords)
        if score > best_score:
            best_score = score
            best_match = tipo
    return best_match


def _parse_file(file) -> tuple[list[str], list[list], int]:
    content = file.file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.reader(io.StringIO(decoded))
    rows = list(reader)
    if not rows:
        raise ValueError("Archivo vacio")

    headers = rows[0]
    data_rows = rows[1:]
    total_filas = len(data_rows)

    return headers, data_rows, total_filas


async def preview_file(db: AsyncSession, company_id: str, file) -> dict:
    headers, data_rows, total_filas = _parse_file(file)
    tipo_detectado = _detect_tipo(headers)
    sample = data_rows[:5]

    return {
        "columnas": headers,
        "filas_ejemplo": sample,
        "total_filas": total_filas,
        "tipo_detectado": tipo_detectado,
    }


async def import_data(
    db: AsyncSession,
    company_id: str,
    file,
    tipo: str,
    column_mapping: dict[str, str],
    skip_header: bool = True,
) -> dict:
    headers, data_rows, total_filas = _parse_file(file)

    # Build reverse mapping: dest_field -> source_col_index
    col_index = {h: i for i, h in enumerate(headers)}
    mapping = {}
    for dest_field, source_header in column_mapping.items():
        if source_header in col_index:
            mapping[dest_field] = col_index[source_header]

    company_uuid = UUID(company_id)
    importados = 0
    errores = 0
    errores_detalle = []
    origen = "csv"

    try:
        if tipo == "productos":
            for idx, row in enumerate(data_rows):
                try:
                    nombre = row[mapping.get("nombre", 0)] if "nombre" in mapping else row[0]
                    sku = row[mapping.get("sku", 0)] if "sku" in mapping else f"MIG-{idx}"
                    precio_str = row[mapping["precio"]] if "precio" in mapping else "0"

                    # Lookup category
                    category_id = None
                    if "categoria" in mapping:
                        cat_name = row[mapping["categoria"]]
                        if cat_name:
                            result = await db.execute(
                                select(ProductCategory).where(
                                    ProductCategory.company_id == company_uuid,
                                    ProductCategory.nombre.ilike(f"%{cat_name.strip()}%"),
                                )
                            )
                            cat = result.scalar_one_or_none()
                            if cat:
                                category_id = cat.id

                    product = Product(
                        company_id=company_uuid,
                        sku=sku,
                        nombre=nombre.strip()[:200],
                        descripcion=row[mapping.get("descripcion", 0)] if "descripcion" in mapping else None,
                        category_id=category_id,
                        activo=True,
                    )
                    db.add(product)
                    importados += 1
                except Exception as e:
                    errores += 1
                    errores_detalle.append(f"Fila {idx+2}: {str(e)}")

        elif tipo == "clientes":
            for idx, row in enumerate(data_rows):
                try:
                    nombre = row[mapping.get("nombre") or mapping.get("razon_social", 0)] if ("nombre" in mapping or "razon_social" in mapping) else row[0]
                    customer = Customer(
                        company_id=company_uuid,
                        razon_social=nombre.strip()[:255],
                        ruc=row[mapping["ruc"]].strip() if "ruc" in mapping else None,
                        ci=row[mapping["ci"]].strip() if "ci" in mapping else None,
                        email=row[mapping["email"]].strip() if "email" in mapping else None,
                        telefono=row[mapping["telefono"]].strip() if "telefono" in mapping else None,
                        direccion=row[mapping["direccion"]].strip() if "direccion" in mapping else None,
                        activo=True,
                    )
                    db.add(customer)
                    importados += 1
                except Exception as e:
                    errores += 1
                    errores_detalle.append(f"Fila {idx+2}: {str(e)}")

        elif tipo == "proveedores":
            for idx, row in enumerate(data_rows):
                try:
                    razon_social = row[mapping.get("razon_social", 0)] if "razon_social" in mapping else row[0]
                    supplier = Supplier(
                        company_id=company_uuid,
                        razon_social=razon_social.strip()[:255],
                        ruc=row[mapping["ruc"]].strip() if "ruc" in mapping else None,
                        email=row[mapping["email"]].strip() if "email" in mapping else None,
                        telefono=row[mapping["telefono"]].strip() if "telefono" in mapping else None,
                        direccion=row[mapping["direccion"]].strip() if "direccion" in mapping else None,
                        activo=True,
                    )
                    db.add(supplier)
                    importados += 1
                except Exception as e:
                    errores += 1
                    errores_detalle.append(f"Fila {idx+2}: {str(e)}")

        elif tipo == "ventas":
            for idx, row in enumerate(data_rows):
                try:
                    from datetime import datetime
                    sale = Sale(
                        company_id=company_uuid,
                        numero=f"MIG-{idx}-{UUID(company_id).hex[:8]}",
                        fecha=datetime.now(),
                        tipo_comprobante="factura",
                        condicion="contado",
                        subtotal=0,
                        total=0,
                        estado="completado",
                    )
                    db.add(sale)
                    importados += 1
                except Exception as e:
                    errores += 1
                    errores_detalle.append(f"Fila {idx+2}: {str(e)}")

        elif tipo == "saldos":
            for idx, row in enumerate(data_rows):
                try:
                    cliente_nombre = row[mapping.get("cliente", 0)] if "cliente" in mapping else row[0]
                    saldo_str = row[mapping["saldo"]].replace(",", ".") if "saldo" in mapping else "0"
                    saldo = float(saldo_str) if saldo_str else 0

                    # Find customer by name
                    result = await db.execute(
                        select(Customer).where(
                            Customer.company_id == company_uuid,
                            Customer.razon_social.ilike(f"%{cliente_nombre.strip()}%"),
                        )
                    )
                    customer = result.scalar_one_or_none()
                    if not customer:
                        errores += 1
                        errores_detalle.append(f"Fila {idx+2}: Cliente '{cliente_nombre}' no encontrado")
                        continue

                    # Create or update credit account
                    result = await db.execute(
                        select(CreditAccount).where(
                            CreditAccount.company_id == company_uuid,
                            CreditAccount.customer_id == customer.id,
                        )
                    )
                    account = result.scalar_one_or_none()
                    if not account:
                        account = CreditAccount(
                            company_id=company_uuid,
                            customer_id=customer.id,
                            limite_credito=float(row[mapping.get("limite", 0)]) if "limite" in mapping else saldo,
                            saldo_disponible=0,
                            saldo_utilizado=saldo,
                        )
                        db.add(account)
                    else:
                        account.saldo_utilizado = saldo

                    movement = CreditMovement(
                        company_id=company_uuid,
                        credit_account_id=account.id,
                        customer_id=customer.id,
                        tipo="ajuste",
                        monto=saldo,
                        saldo_anterior=0,
                        saldo_nuevo=saldo,
                        observaciones="Migracion inicial de saldos",
                    )
                    db.add(movement)
                    importados += 1
                except Exception as e:
                    errores += 1
                    errores_detalle.append(f"Fila {idx+2}: {str(e)}")

    except Exception as e:
        errores += 1
        errores_detalle.append(f"Error general: {str(e)}")

    log = MigrationLog(
        company_id=company_uuid,
        tipo=tipo,
        origen=origen,
        archivo_nombre=getattr(file, "filename", None) or "upload.csv",
        estado="completado" if errores == 0 else "parcial",
        total_registros=total_filas,
        importados=importados,
        errores=errores,
        errores_detalle=json.dumps(errores_detalle, ensure_ascii=False) if errores_detalle else None,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)

    return {
        "log_id": str(log.id),
        "tipo": tipo,
        "total": total_filas,
        "importados": importados,
        "errores": errores,
        "errores_detalle": errores_detalle[:10],
    }


async def get_migration_logs(
    db: AsyncSession,
    company_id: str,
) -> list[MigrationLog]:
    company_uuid = UUID(company_id)
    result = await db.execute(
        select(MigrationLog)
        .where(MigrationLog.company_id == company_uuid)
        .order_by(MigrationLog.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())

