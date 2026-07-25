from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
import uuid
import hashlib
import io
import csv

from api.src.sifen_avanzado.models import (
    DgrVehicle, EkuatiaDocument, CdcValidationLog,
    IvaBookConfig, DgrReportGenerated,
)
from api.src.sifen_avanzado.schemas import (
    DistribuidoraInvoiceRequest,
    DgrVehicleCreate, DgrVehicleUpdate,
    EkuatiaDocumentCreate,
    BatchCdcValidationRequest,
    SifenAvanzadoDashboard,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _today():
    return date.today()

def _now():
    return datetime.now(timezone.utc)


# ── DISTRIBUIDORA INVOICE ────────────────────────────────────────────────────

async def send_distribuidora_invoice(db: AsyncSession, data: DistribuidoraInvoiceRequest, user_id: str | None = None):
    from api.src.sales.models import Sale, SaleItem
    from api.src.sales.service import calculate_taxes
    from api.src.sifen.service import send_sale_to_sifen

    cid = uuid.UUID(data.company_id)
    customer_id = uuid.UUID(data.customer_id)

    numero_res = await db.execute(
        text("SELECT COALESCE(MAX(CAST(SPLIT_PART(numero, '-', 3) AS INTEGER)), 0) + 1 FROM sales WHERE company_id = :cid"),
        {"cid": data.company_id},
    )
    next_num = numero_res.scalar() or 1
    numero = f"DIST-001-{next_num:06d}"

    items_data = []
    subtotal = Decimal("0")
    for item in data.items:
        cant = Decimal(str(item.get("cantidad", 1)))
        pu = Decimal(str(item.get("precio_unitario", 0)))
        total_item = cant * pu
        subtotal += total_item
        items_data.append({
            "product_id": item.get("product_id"),
            "descripcion": item.get("descripcion", ""),
            "cantidad": cant,
            "precio_unitario": pu,
            "iva_tasa": Decimal(str(item.get("iva_tasa", 10))),
            "total": total_item,
        })

    taxes = calculate_taxes(items_data)
    total = taxes["total"]

    sale = Sale(
        company_id=cid,
        customer_id=customer_id,
        numero=numero,
        fecha=_now(),
        tipo_comprobante="factura",
        condicion=data.condicion,
        moneda="PYG",
        subtotal=subtotal,
        total=total,
        total_pagado=Decimal("0"),
        saldo=total if data.condicion == "credito" else Decimal("0"),
        estado="completado",
        base_gravada_10=taxes["base_gravada_10"],
        base_gravada_5=taxes["base_gravada_5"],
        base_exenta=taxes["base_exenta"],
        iva_10=taxes["iva_10"],
        iva_5=taxes["iva_5"],
        observaciones=data.observaciones,
        user_id=uuid.UUID(user_id) if user_id else None,
    )
    db.add(sale)
    await db.flush()

    for item_data in items_data:
        item = SaleItem(
            sale_id=sale.id,
            product_id=uuid.UUID(item_data["product_id"]) if isinstance(item_data["product_id"], str) else None,
            descripcion=item_data["descripcion"],
            cantidad=item_data["cantidad"],
            precio_unitario=item_data["precio_unitario"],
            iva_tasa=item_data["iva_tasa"],
            iva_monto=item_data["iva_tasa"] / Decimal("100") * item_data["total"] if item_data["iva_tasa"] > 0 else Decimal("0"),
            total=item_data["total"],
        )
        db.add(item)

    await db.flush()

    try:
        result = await send_sale_to_sifen(db, str(sale.id))
        await db.refresh(sale)
    except Exception:
        await db.refresh(sale)

    return {
        "id": str(sale.id),
        "numero": sale.numero,
        "cdc": sale.cdc,
        "sifen_estado": sale.sifen_estado,
        "total": float(sale.total),
        "condicion": sale.condicion,
    }


# ── IVA BOOKS ────────────────────────────────────────────────────────────────

async def get_iva_book(db: AsyncSession, company_id: str, tipo: str, periodo: str) -> dict:
    anio, mes = periodo.split("-")
    y, m = int(anio), int(mes)
    import calendar
    inicio = date(y, m, 1)
    ultimo = calendar.monthrange(y, m)[1]
    fin = date(y, m, ultimo)

    entries = []

    if tipo == "ventas":
        rows = await db.execute(
            text("""
                SELECT s.fecha::date, s.numero, s.tipo_comprobante,
                       c.ruc, COALESCE(c.razon_social, c.nombre) as razon_social,
                       COALESCE(s.base_gravada_5, 0) as base_5,
                       COALESCE(s.base_gravada_10, 0) as base_10,
                       COALESCE(s.base_exenta, 0) as exenta,
                       COALESCE(s.iva_5, 0) as iva_5,
                       COALESCE(s.iva_10, 0) as iva_10,
                       COALESCE(s.total, 0) as total,
                       s.cdc
                FROM sales s
                LEFT JOIN customers c ON c.id = s.customer_id
                WHERE s.company_id = :cid
                  AND s.estado != 'anulado'
                  AND s.fecha::date >= :inicio
                  AND s.fecha::date <= :fin
                ORDER BY s.fecha
            """),
            {"cid": company_id, "inicio": inicio, "fin": fin},
        )
        for r in rows:
            entries.append({
                "fecha": r[0], "numero_documento": r[1], "tipo_documento": r[2],
                "ruc": r[3] or "", "razon_social": r[4] or "",
                "base_gravada_5": float(r[5] or 0), "base_gravada_10": float(r[6] or 0),
                "exenta": float(r[7] or 0), "iva_5": float(r[8] or 0),
                "iva_10": float(r[9] or 0), "total": float(r[10] or 0),
                "cdc": r[11],
            })

    elif tipo == "compras":
        rows = await db.execute(
            text("""
                SELECT si.fecha_emision, si.numero_factura, si.tipo_comprobante,
                       sp.ruc, sp.nombre as razon_social,
                       COALESCE(si.iva_5, 0) as iva_5_raw,
                       COALESCE(si.iva_10, 0) as iva_10_raw,
                       COALESCE(si.subtotal, si.total) as subtotal,
                       COALESCE(si.total, 0) as total,
                       si.cdc
                FROM supplier_invoices si
                LEFT JOIN suppliers sp ON sp.id = si.supplier_id
                WHERE si.company_id = :cid
                  AND si.fecha_emision >= :inicio
                  AND si.fecha_emision <= :fin
                ORDER BY si.fecha_emision
            """),
            {"cid": company_id, "inicio": inicio, "fin": fin},
        )
        for r in rows:
            iva_5_raw = float(r[6] or 0)
            iva_10_raw = float(r[7] or 0)
            subtotal_val = float(r[8] or 0)
            base_5 = round(iva_5_raw / 0.05, 2) if iva_5_raw > 0 else 0
            base_10 = round(iva_10_raw / 0.10, 2) if iva_10_raw > 0 else 0
            exenta = round(subtotal_val - base_5 - base_10, 2) if subtotal_val > 0 else 0
            entries.append({
                "fecha": r[0], "numero_documento": r[1], "tipo_documento": r[2] or "factura",
                "ruc": r[3] or "", "razon_social": r[4] or "",
                "base_gravada_5": base_5, "base_gravada_10": base_10,
                "exenta": exenta, "iva_5": iva_5_raw, "iva_10": iva_10_raw,
                "total": float(r[9] or 0), "cdc": r[10],
            })

    total_base_5 = sum(e["base_gravada_5"] for e in entries)
    total_base_10 = sum(e["base_gravada_10"] for e in entries)
    total_exenta = sum(e["exenta"] for e in entries)
    total_iva_5 = sum(e["iva_5"] for e in entries)
    total_iva_10 = sum(e["iva_10"] for e in entries)
    total_general = sum(e["total"] for e in entries)

    return {
        "periodo": periodo,
        "tipo": tipo,
        "entries": entries,
        "total_base_5": round(total_base_5, 2),
        "total_base_10": round(total_base_10, 2),
        "total_exenta": round(total_exenta, 2),
        "total_iva_5": round(total_iva_5, 2),
        "total_iva_10": round(total_iva_10, 2),
        "total_general": round(total_general, 2),
    }


async def export_iva_book_csv(db: AsyncSession, company_id: str, tipo: str, periodo: str) -> io.StringIO:
    data = await get_iva_book(db, company_id, tipo, periodo)
    output = io.StringIO()
    writer = csv.writer(output)

    header = ["Fecha", "Nro. Documento", "Tipo", "RUC", "Razón Social"]
    if tipo == "compras":
        header += ["Base 5%", "Base 10%", "Exenta", "IVA 5%", "IVA 10%", "Total", "CDC"]
    else:
        header += ["Base 5%", "Base 10%", "Exenta", "IVA 5%", "IVA 10%", "Total", "CDC"]
    writer.writerow(["LIBRO DE IVA " + tipo.upper(), "Período: " + periodo])
    writer.writerow([])
    writer.writerow(header)

    for e in data["entries"]:
        writer.writerow([
            e["fecha"], e["numero_documento"], e["tipo_documento"],
            e["ruc"], e["razon_social"],
            f"{e['base_gravada_5']:.2f}", f"{e['base_gravada_10']:.2f}",
            f"{e['exenta']:.2f}", f"{e['iva_5']:.2f}", f"{e['iva_10']:.2f}",
            f"{e['total']:.2f}", e["cdc"],
        ])

    writer.writerow([])
    writer.writerow(["TOTALES", "", "", "", "",
                     f"{data['total_base_5']:.2f}", f"{data['total_base_10']:.2f}",
                     f"{data['total_exenta']:.2f}", f"{data['total_iva_5']:.2f}",
                     f"{data['total_iva_10']:.2f}", f"{data['total_general']:.2f}", ""])

    output.seek(0)
    return output


# ── RETENTION BOOK ────────────────────────────────────────────────────────────

async def get_retention_book(db: AsyncSession, company_id: str, periodo: str) -> dict:
    anio, mes = periodo.split("-")
    import calendar
    inicio = date(int(anio), int(mes), 1)
    fin = date(int(anio), int(mes), calendar.monthrange(int(anio), int(mes))[1])

    rows = await db.execute(
        text("""
            SELECT wd.periodo_fiscal, wd.numero_documento,
                   sp.ruc, sp.nombre as proveedor_nombre,
                   wd.tipo, wd.base_imponible, wd.tasa, wd.monto_retenido,
                   wd.fecha_emision, wd.cdc
            FROM withholding_documents wd
            LEFT JOIN suppliers sp ON sp.id = wd.supplier_id
            WHERE wd.company_id = :cid
              AND wd.estado IN ('aprobado', 'enviado')
              AND wd.periodo_fiscal = :periodo
            ORDER BY wd.fecha_emision
        """),
        {"cid": company_id, "periodo": periodo},
    )

    entries = []
    total_iva = 0
    total_irp = 0
    for r in rows:
        monto = float(r[7] or 0)
        tipo = r[4]
        entries.append({
            "periodo": r[0], "numero_documento": r[1],
            "ruc_proveedor": r[2] or "", "nombre_proveedor": r[3] or "",
            "tipo_retencion": tipo,
            "base_imponible": float(r[5] or 0), "tasa": float(r[6] or 0),
            "monto_retenido": monto,
            "fecha_emision": r[8], "cdc": r[9],
        })
        if tipo == "IVA":
            total_iva += monto
        elif tipo == "IRP":
            total_irp += monto

    return {
        "periodo": periodo,
        "entries": entries,
        "total_retenido_iva": round(total_iva, 2),
        "total_retenido_irp": round(total_irp, 2),
        "total_general": round(total_iva + total_irp, 2),
    }


async def export_retention_book_csv(db: AsyncSession, company_id: str, periodo: str) -> io.StringIO:
    data = await get_retention_book(db, company_id, periodo)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["LIBRO DE RETENCIONES IVA / IRP", "Período: " + periodo])
    writer.writerow([])
    writer.writerow(["Período", "Nro. Documento", "RUC Proveedor", "Nombre",
                     "Tipo", "Base Imponible", "Tasa %", "Monto Retenido", "Fecha", "CDC"])
    for e in data["entries"]:
        writer.writerow([
            e["periodo"], e["numero_documento"], e["ruc_proveedor"],
            e["nombre_proveedor"], e["tipo_retencion"],
            f"{e['base_imponible']:.2f}", f"{e['tasa']:.2f}",
            f"{e['monto_retenido']:.2f}", e["fecha_emision"], e["cdc"],
        ])
    writer.writerow([])
    writer.writerow(["TOTALES", "", "", "",
                     f"IVA: {data['total_retenido_iva']:.2f} / IRP: {data['total_retenido_irp']:.2f}",
                     "", "", f"{data['total_general']:.2f}", "", ""])
    output.seek(0)
    return output


# ── DGR VEHICLES ─────────────────────────────────────────────────────────────

async def list_dgr_vehicles(db: AsyncSession, company_id: str, activo: bool | None = None):
    q = select(DgrVehicle).where(DgrVehicle.company_id == uuid.UUID(company_id))
    if activo is not None:
        q = q.where(DgrVehicle.activo == activo)
    q = q.order_by(DgrVehicle.patente)
    r = await db.execute(q)
    return list(r.scalars().all())


async def create_dgr_vehicle(db: AsyncSession, data: DgrVehicleCreate):
    v = DgrVehicle(
        company_id=uuid.UUID(data.company_id),
        patente=data.patente.upper(),
        marca=data.marca,
        modelo=data.modelo,
        anio=data.anio,
        tipo=data.tipo,
        chasis=data.chasis,
        motor=data.motor,
        capacidad_toneladas=Decimal(str(data.capacidad_toneladas)) if data.capacidad_toneladas else None,
        propietario=data.propietario,
        ruc_propietario=data.ruc_propietario,
        color=data.color,
    )
    db.add(v)
    await db.flush()
    await db.refresh(v)
    return v


async def update_dgr_vehicle(db: AsyncSession, vehicle_id: str, data: DgrVehicleUpdate):
    r = await db.execute(select(DgrVehicle).where(DgrVehicle.id == uuid.UUID(vehicle_id)))
    v = r.scalar_one_or_none()
    if not v:
        return None
    for field in ("marca", "modelo", "tipo", "chasis", "motor", "propietario", "color"):
        val = getattr(data, field, None)
        if val is not None:
            setattr(v, field, val)
    if data.anio is not None:
        v.anio = data.anio
    if data.capacidad_toneladas is not None:
        v.capacidad_toneladas = Decimal(str(data.capacidad_toneladas))
    if data.activo is not None:
        v.activo = data.activo
    await db.flush()
    await db.refresh(v)
    return v


async def generate_dgr_report(db: AsyncSession, company_id: str, periodo: str) -> dict:
    anio, mes = periodo.split("-")
    y, m = int(anio), int(mes)
    import calendar
    inicio = date(y, m, 1)
    fin = date(y, m, calendar.monthrange(y, m)[1])

    vehicles = await db.execute(
        select(DgrVehicle).where(DgrVehicle.company_id == uuid.UUID(company_id), DgrVehicle.activo == True)
    )
    v_list = list(vehicles.scalars().all())

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["REPORTE DGR - VEHÍCULOS DE REPARTO"])
    writer.writerow(["Período:", periodo])
    writer.writerow(["Generado:", _now().isoformat()])
    writer.writerow([])
    writer.writerow(["Patente", "Marca", "Modelo", "Año", "Tipo", "Capacidad (Tn)",
                     "Chasis", "Motor", "Propietario", "RUC Prop.", "Color"])

    for v in v_list:
        writer.writerow([
            v.patente, v.marca, v.modelo, v.anio, v.tipo,
            float(v.capacidad_toneladas) if v.capacidad_toneladas else "",
            v.chasis or "", v.motor or "", v.propietario or "",
            v.ruc_propietario or "", v.color or "",
        ])

    output.seek(0)
    csv_content = output.getvalue()

    archivo_path = f"dgr_reports/{company_id}/{periodo}_vehiculos.csv"

    report = DgrReportGenerated(
        company_id=uuid.UUID(company_id),
        periodo=periodo,
        tipo="vehiculos",
        archivo_path=archivo_path,
        cantidad_vehiculos=len(v_list),
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)

    return {
        "id": str(report.id),
        "periodo": periodo,
        "tipo": "vehiculos",
        "cantidad_vehiculos": len(v_list),
        "archivo_path": archivo_path,
        "fecha_generacion": report.fecha_generacion,
        "csv_content": csv_content,
    }


async def list_dgr_reports(db: AsyncSession, company_id: str, limit: int = 20):
    q = select(DgrReportGenerated).where(
        DgrReportGenerated.company_id == uuid.UUID(company_id)
    ).order_by(DgrReportGenerated.fecha_generacion.desc()).limit(limit)
    r = await db.execute(q)
    return list(r.scalars().all())


# ── e-KUATIA DOCUMENTS ───────────────────────────────────────────────────────

async def list_ekuatia_documents(db: AsyncSession, company_id: str, sale_id: str | None = None):
    q = select(EkuatiaDocument).where(EkuatiaDocument.company_id == uuid.UUID(company_id))
    if sale_id:
        q = q.where(EkuatiaDocument.sale_id == uuid.UUID(sale_id))
    q = q.order_by(EkuatiaDocument.fecha_digitalizacion.desc())
    r = await db.execute(q)
    return list(r.scalars().all())


async def create_ekuatia_document(db: AsyncSession, data: EkuatiaDocumentCreate, user_id: str | None = None):
    doc_hash = None
    if data.archivo_path:
        doc_hash = hashlib.sha256(data.archivo_path.encode()).hexdigest()

    doc = EkuatiaDocument(
        company_id=uuid.UUID(data.company_id),
        sale_id=uuid.UUID(data.sale_id) if data.sale_id else None,
        tipo_documento=data.tipo_documento,
        nombre_original=data.nombre_original,
        archivo_path=data.archivo_path,
        hash_sha256=data.hash_sha256 or doc_hash,
        validez_legal=True,
        uploaded_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return doc


async def verify_ekuatia_document(db: AsyncSession, doc_id: str):
    r = await db.execute(select(EkuatiaDocument).where(EkuatiaDocument.id == uuid.UUID(doc_id)))
    doc = r.scalar_one_or_none()
    if not doc:
        return None
    doc.validez_legal = True
    await db.flush()
    await db.refresh(doc)
    return doc


# ── CDC VALIDATION ───────────────────────────────────────────────────────────

async def validate_cdc(db: AsyncSession, company_id: str, sale_id: str, cdc_str: str) -> dict:
    cid = uuid.UUID(company_id)
    sid = uuid.UUID(sale_id)

    if len(cdc_str) != 44 or not cdc_str.isalnum() or not cdc_str.isupper():
        log = CdcValidationLog(
            company_id=cid, sale_id=sid, cdc=cdc_str,
            valido=False, response_data={"error": "Formato CDC inválido"},
            codigo_error="FORMATO_INVALIDO",
            mensaje_error="El CDC debe tener 44 caracteres alfanuméricos en mayúsculas",
        )
        db.add(log)
        await db.flush()
        return {"cdc": cdc_str, "valido": False, "mensaje": log.mensaje_error, "fecha_consulta": _now()}

    from api.src.sifen.client import send_to_sifen
    try:
        from api.src.salen.cdc import validate_cdc as validate_cdc_format
        formato_valido = validate_cdc_format(cdc_str)
    except ImportError:
        formato_valido = True

    response = None
    error_msg = None
    try:
        response = await send_to_sifen(cdc_str)
    except Exception as e:
        error_msg = str(e)

    valido = False
    if response and response.get("estado") == "vigente":
        valido = True

    log = CdcValidationLog(
        company_id=cid, sale_id=sid, cdc=cdc_str,
        valido=valido,
        request_data={"cdc": cdc_str, "sale_id": sale_id},
        response_data=response or {"error": error_msg or "Sin respuesta"},
        codigo_error=response.get("codigo_error") if response else "SIN_RESPUESTA",
        mensaje_error=error_msg or response.get("mensaje_error") if response else "No se pudo conectar con SIFEN",
    )
    db.add(log)
    await db.flush()

    if valido:
        from api.src.sales.models import Sale
        await db.execute(
            text("UPDATE sales SET cdc = :cdc, sifen_estado = 'validado' WHERE id = :sid AND company_id = :cid"),
            {"cdc": cdc_str, "sid": sale_id, "cid": company_id},
        )
        await db.commit()

    return {
        "cdc": cdc_str,
        "valido": valido,
        "mensaje": "CDC válido" if valido else (error_msg or "CDC no válido"),
        "fecha_consulta": _now(),
    }


async def batch_validate_cdc(db: AsyncSession, data: BatchCdcValidationRequest) -> list[dict]:
    results = []
    for sale_id in data.sale_ids:
        sale_r = await db.execute(
            text("SELECT id, cdc FROM sales WHERE id = :sid AND company_id = :cid"),
            {"sid": sale_id, "cid": data.company_id},
        )
        sale = sale_r.fetchone()
        if not sale:
            results.append({"sale_id": sale_id, "cdc": None, "valido": False, "mensaje": "Venta no encontrada"})
            continue
        cdc_str = sale[1]
        if not cdc_str:
            results.append({"sale_id": sale_id, "cdc": None, "valido": False, "mensaje": "Sin CDC"})
            continue
        result = await validate_cdc(db, data.company_id, sale_id, cdc_str)
        results.append({"sale_id": sale_id, **result})
    return results


# ── DASHBOARD ────────────────────────────────────────────────────────────────

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    cid = company_id
    today = _today()
    current_period = today.strftime("%Y-%m")
    y, m = int(today.year), int(today.month)
    import calendar
    inicio = date(y, m, 1)
    fin = date(y, m, calendar.monthrange(y, m)[1])

    facturas_mes = await db.execute(
        text("SELECT COUNT(*) FROM sales WHERE company_id = :cid AND estado != 'anulado' AND fecha::date >= :inicio AND fecha::date <= :fin"),
        {"cid": cid, "inicio": inicio, "fin": fin},
    )
    total_facturas = facturas_mes.scalar() or 0

    pend_sifen = await db.execute(
        text("SELECT COUNT(*) FROM sales WHERE company_id = :cid AND sifen_estado IS NULL AND estado != 'anulado'"),
        {"cid": cid},
    )
    pendientes = pend_sifen.scalar() or 0

    con_cdc = await db.execute(
        text("SELECT COUNT(*) FROM sales WHERE company_id = :cid AND cdc IS NOT NULL AND estado != 'anulado'"),
        {"cid": cid},
    )
    con_cdc_count = con_cdc.scalar() or 0

    rechazadas = await db.execute(
        text("SELECT COUNT(*) FROM sales WHERE company_id = :cid AND sifen_estado = 'rechazado'"),
        {"cid": cid},
    )
    rechazadas_count = rechazadas.scalar() or 0

    docs_ekuatia = await db.execute(
        select(func.count()).where(EkuatiaDocument.company_id == uuid.UUID(cid))
    )
    ekuatia_count = docs_ekuatia.scalar() or 0

    vehiculos = await db.execute(
        select(func.count()).where(DgrVehicle.company_id == uuid.UUID(cid), DgrVehicle.activo == True)
    )
    vehiculos_count = vehiculos.scalar() or 0

    cdc_val = await db.execute(
        text("SELECT COUNT(*) FROM cdc_validation_logs WHERE company_id = :cid AND valido = TRUE"),
        {"cid": cid},
    )
    cdc_validos = cdc_val.scalar() or 0

    cdc_inv = await db.execute(
        text("SELECT COUNT(*) FROM cdc_validation_logs WHERE company_id = :cid AND valido = FALSE"),
        {"cid": cid},
    )
    cdc_invalidos = cdc_inv.scalar() or 0

    ret_periodo = await db.execute(
        text("SELECT COUNT(*) FROM withholding_documents WHERE company_id = :cid AND periodo_fiscal = :periodo"),
        {"cid": cid, "periodo": current_period},
    )
    retenciones = ret_periodo.scalar() or 0

    compliance = 100.0
    if total_facturas > 0:
        sifen_rate = con_cdc_count / total_facturas
        compliance = round(sifen_rate * 100, 1)

    return {
        "total_facturas_mes": total_facturas,
        "facturas_pendientes_sifen": pendientes,
        "facturas_con_cdc": con_cdc_count,
        "facturas_rechazadas": rechazadas_count,
        "libros_iva_generados_mes": 1 if pendientes == 0 else 0,
        "documentos_ekuatia": ekuatia_count,
        "vehiculos_registrados": vehiculos_count,
        "cdc_validados": cdc_validos,
        "cdc_invalidos": cdc_invalidos,
        "retenciones_del_periodo": retenciones,
        "compliance_score": compliance,
    }
