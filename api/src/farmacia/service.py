"""Farmacia / Drogueria service - safety engine, DINALFA PDF, OS billing, dashboard."""
import io
import os
import hashlib
import hmac
import secrets
import json
from datetime import datetime, timezone, date, timedelta
from calendar import monthrange
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.farmacia import models, schemas


# SAFETY ENGINE - 6 CHECKS

# Beers list: meds inapropiados en >65 anhos
_BEERS_LIST = {
    "diazepam", "alprazolam", "lorazepam", "clonazepam", "midazolam",
    "amitriptilina", "nortriptilina", "imipramina", "clomipramina",
    "clorfeniramina", "difenidramina", "hidroxicina",
    "metoclopramida", "prometazina",
    "indometacina", "ketorolaco", "piroxicam", "meloxicam",
    "nifedipino", "amiodarona",
    "nitrofurantoina", "trimetoprim",
}

# Ajuste renal (<60 TFG)
_RENAL_ADJUST = {
    "metformina", "ibuprofeno", "naproxeno", "ketoprofeno", "diclofenaco",
    "aspirina", "acido_aceticilsalicilico", "enalapril", "ramipril", "lisinopril",
    "lithium", "digoxina", "gabapentin", "pregabalina",
    "alopurinol", "colchicina", "metotrexato", "ciprofloxacino",
    "famotidina", "ranitidina", "omeprazol", "pantoprazol",
}

# ATC duplicates (4 primeros chars)
_ATC_CLASSES = {
    "A02BC": "IBP (omeprazol, etc)",
    "M01AE": "AINE Propionico (ibuprofeno, naproxeno, ketoprofeno)",
    "M01AB": "AINE Acetico (diclofenaco, ketorolaco, indometacina)",
    "N02BA": "Salicilatos (aspirina, AAS)",
    "N02BE": "Anilidas (paracetamol)",
    "C09AA": "IECAs (enalapril, etc)",
    "C09CA": "ARA-II (losartan, etc)",
    "C10AA": "Estatinas (simvastatina, atorvastatina)",
    "J01CA": "Penicilinas",
    "J01MA": "Fluoroquinolonas",
    "N05BA": "Benzodiazepinas",
    "N06AB": "ISRS",
}


def _now():
    return datetime.now(timezone.utc)


async def _check_alergias(db, company_id, paciente_id, pa_ids):
    if not paciente_id or not pa_ids:
        return []
    q = select(models.AlergiaPaciente).where(
        and_(
            models.AlergiaPaciente.paciente_id == paciente_id,
            models.AlergiaPaciente.activo == True,
            or_(
                models.AlergiaPaciente.principio_activo_id.in_(pa_ids),
                models.AlergiaPaciente.sustancia.in_(
                    select(models.ActiveIngredient.nombre).where(
                        models.ActiveIngredient.id.in_(pa_ids)
                    )
                ),
            ),
        )
    )
    r = await db.execute(q)
    alerts = []
    for a in r.scalars().all():
        sev = a.severidad.lower()
        level = "blocking" if sev in ("severa", "anafilaxia") else ("severe" if sev == "moderada" else "warning")
        alerts.append({
            "tipo": "alergia",
            "nivel": level,
            "codigo": f"ALG-{sev.upper()}",
            "mensaje": f"Alergia conocida a {a.sustancia} ({sev})",
            "detalles": {"reaccion": a.reaccion, "fecha": str(a.fecha_deteccion) if a.fecha_deteccion else None},
            "recomendacion": "No dispensar. Considerar alternativa terapeutica." if level == "blocking" else "Verificar reaccion. Monitoreo.",
        })
    return alerts


async def _check_embarazo_lactancia(db, paciente_id, pa_ids):
    if not paciente_id:
        return []
    pac_q = select(models.Paciente).where(models.Paciente.id == paciente_id)
    r = await db.execute(pac_q)
    paciente = r.scalar_one_or_none()
    if not paciente or not (paciente.embarazada or paciente.lactando):
        return []
    if not pa_ids:
        return []

    pa_q = select(models.ActiveIngredient).where(models.ActiveIngredient.id.in_(pa_ids))
    r2 = await db.execute(pa_q)
    alerts = []
    for pa in r2.scalars().all():
        cat = (pa.embarazo_categoria or "N").upper()
        if paciente.embarazada:
            if cat in ("D", "X"):
                alerts.append({
                    "tipo": "embarazo",
                    "nivel": "blocking",
                    "codigo": f"EMB-CAT-{cat}",
                    "mensaje": f"{pa.nombre} categoria {cat} - CONTRAINDICADO en embarazo",
                    "detalles": {"principio_activo": pa.nombre, "categoria": cat},
                    "recomendacion": "No dispensar. Consultar medico. Alternativa: paracetamol (cat. B).",
                })
            elif cat == "C":
                alerts.append({
                    "tipo": "embarazo",
                    "nivel": "severe",
                    "codigo": f"EMB-CAT-{cat}",
                    "mensaje": f"{pa.nombre} categoria C - usar con precaucion en embarazo",
                    "detalles": {"principio_activo": pa.nombre, "categoria": cat},
                    "recomendacion": "Solo si beneficio justifica riesgo. Confirmar con medico.",
                })
        if paciente.lactando and cat in ("D", "X"):
            alerts.append({
                "tipo": "lactancia",
                "nivel": "severe",
                "codigo": f"LACT-CAT-{cat}",
                "mensaje": f"{pa.nombre} categoria {cat} - precaucion en lactancia",
                "detalles": {"principio_activo": pa.nombre, "categoria": cat},
                "recomendacion": "Evaluar suspension de lactancia o alternativa segura.",
            })
    return alerts


async def _check_interacciones(db, company_id, pa_ids, current_pa_ids):
    if not pa_ids or not current_pa_ids:
        return []
    all_pa = list(set(pa_ids + current_pa_ids))
    if len(all_pa) < 2:
        return []

    q = select(models.DrugInteraction).where(
        and_(
            or_(
                models.DrugInteraction.principio_activo_a_id.in_(all_pa),
                models.DrugInteraction.principio_activo_b_id.in_(all_pa),
            ),
            models.DrugInteraction.activo == True,
        )
    )
    r = await db.execute(q)
    alerts = []
    pa_names_cache = {}

    async def _get_pa_name(pid):
        if pid not in pa_names_cache:
            pa_q = select(models.ActiveIngredient.nombre).where(models.ActiveIngredient.id == pid)
            rs = await db.execute(pa_q)
            pa_names_cache[pid] = rs.scalar_one_or_none() or str(pid)
        return pa_names_cache[pid]

    for intr in r.scalars().all():
        if intr.principio_activo_a_id not in all_pa or intr.principio_activo_b_id not in all_pa:
            continue
        sev = intr.severidad.lower()
        if sev == "contraindicada":
            level = "blocking"
        elif sev == "grave":
            level = "severe"
        elif sev == "moderada":
            level = "warning"
        else:
            level = "info"

        name_a = await _get_pa_name(intr.principio_activo_a_id)
        name_b = await _get_pa_name(intr.principio_activo_b_id)

        alerts.append({
            "tipo": "ddi",
            "nivel": level,
            "codigo": f"DDI-{sev.upper()}",
            "mensaje": f"Interaccion {sev}: {name_a} x {name_b}",
            "detalles": {
                "mecanismo": intr.mecanismo,
                "efecto_clinico": intr.efecto_clinico,
                "nivel_evidencia": intr.nivel_evidencia,
            },
            "recomendacion": intr.recomendacion,
        })
    return alerts


async def _check_duplicidad_terapeutica(db, pa_ids):
    if not pa_ids or len(pa_ids) < 2:
        return []
    q = select(models.ActiveIngredient).where(models.ActiveIngredient.id.in_(pa_ids))
    r = await db.execute(q)
    atc_map = {}
    for pa in r.scalars().all():
        atc = (pa.codigo_atc or "").upper()
        if len(atc) >= 4:
            cls = atc[:4]
            atc_map.setdefault(cls, []).append(pa.nombre)
    alerts = []
    for cls, names in atc_map.items():
        if len(names) > 1:
            alerts.append({
                "tipo": "duplicidad",
                "nivel": "warning",
                "codigo": f"DUP-ATC{cls}",
                "mensaje": f"Duplicidad terapeutica ATC {cls}: {', '.join(names)}",
                "detalles": {"atc": cls, "medicamentos": names, "clase": _ATC_CLASSES.get(cls, "")},
                "recomendacion": "Verificar si el paciente realmente necesita ambos. Considerar suspender uno.",
            })
    return alerts


async def _check_beers(db, paciente_id, pa_ids):
    if not paciente_id or not pa_ids:
        return []
    pac_q = select(models.Paciente).where(models.Paciente.id == paciente_id)
    r = await db.execute(pac_q)
    paciente = r.scalar_one_or_none()
    if not paciente or not paciente.fecha_nacimiento:
        return []
    edad = (date.today() - paciente.fecha_nacimiento).days / 365.25
    if edad < 65:
        return []

    pa_q = select(models.ActiveIngredient).where(models.ActiveIngredient.id.in_(pa_ids))
    r2 = await db.execute(pa_q)
    alerts = []
    for pa in r2.scalars().all():
        nombre_norm = pa.nombre.lower()
        for ch, repl in [("a", "a"), ("e", "e"), ("i", "i"), ("o", "o"), ("u", "u")]:
            pass
        if nombre_norm in _BEERS_LIST:
            alerts.append({
                "tipo": "beers",
                "nivel": "warning",
                "codigo": f"BEERS-{pa.nombre[:20].upper()}",
                "mensaje": f"{pa.nombre} - Beers 2023: potencialmente inapropiado en adultos mayores (edad {int(edad)} anhos)",
                "detalles": {"edad": int(edad), "principio_activo": pa.nombre},
                "recomendacion": "Considerar alternativa mas segura. Evaluar riesgo/beneficio.",
            })
    return alerts


async def _check_renal(db, paciente_id, pa_ids):
    if not paciente_id or not pa_ids:
        return []
    pac_q = select(models.Paciente).where(models.Paciente.id == paciente_id)
    r = await db.execute(pac_q)
    paciente = r.scalar_one_or_none()
    if not paciente:
        return []
    tfg = float(paciente.tfg_ml_min) if paciente.tfg_ml_min else None
    if not tfg or tfg >= 60:
        return []

    pa_q = select(models.ActiveIngredient).where(models.ActiveIngredient.id.in_(pa_ids))
    r2 = await db.execute(pa_q)
    alerts = []
    for pa in r2.scalars().all():
        nombre_norm = pa.nombre.lower()
        if nombre_norm in _RENAL_ADJUST:
            level = "blocking" if tfg < 30 else "severe"
            alerts.append({
                "tipo": "renal",
                "nivel": level,
                "codigo": f"RENAL-TFG{int(tfg)}",
                "mensaje": f"{pa.nombre} requiere ajuste de dosis en TFG {int(tfg)} mL/min",
                "detalles": {"tfg": tfg, "principio_activo": pa.nombre, "funcion_renal": paciente.insuficiencia_renal},
                "recomendacion": "Ajustar dosis o frecuencia. Monitorear funcion renal." if level == "severe" else "Evitar. Alto riesgo de acumulacion.",
            })
    return alerts


async def check_safety(db, company_id, paciente_id, new_pa_ids, current_meds_ids=None):
    alerts = []
    if current_meds_ids:
        cur_q = select(models.Medication.principio_activo_id).where(models.Medication.id.in_(current_meds_ids))
        r = await db.execute(cur_q)
        current_pa_ids = [row[0] for row in r.all()]
    else:
        current_pa_ids = []

    if paciente_id and not current_meds_ids:
        hist_q = select(models.PacienteHistorial.medication_id).where(
            and_(models.PacienteHistorial.paciente_id == paciente_id, models.PacienteHistorial.dispensacion_id.isnot(None))
        ).order_by(desc(models.PacienteHistorial.created_at)).limit(20)
        r = await db.execute(hist_q)
        hist_meds = [row[0] for row in r.all()]
        if hist_meds:
            cur_q = select(models.Medication.principio_activo_id).where(models.Medication.id.in_(hist_meds))
            r2 = await db.execute(cur_q)
            current_pa_ids = [row[0] for row in r2.all()]

    alerts += await _check_alergias(db, company_id, paciente_id, new_pa_ids)
    alerts += await _check_embarazo_lactancia(db, paciente_id, new_pa_ids)
    alerts += await _check_interacciones(db, company_id, new_pa_ids, current_pa_ids)
    alerts += await _check_duplicidad_terapeutica(db, new_pa_ids)
    alerts += await _check_beers(db, paciente_id, new_pa_ids)
    alerts += await _check_renal(db, paciente_id, new_pa_ids)

    blocking = [a for a in alerts if a["nivel"] == "blocking"]
    puede = len(blocking) == 0

    level_priority = {"blocking": 4, "severe": 3, "warning": 2, "info": 1}
    nivel_max = "none"
    if alerts:
        nivel_max = max(alerts, key=lambda x: level_priority.get(x["nivel"], 0))["nivel"]

    return {
        "puede_dispensar": puede,
        "alertas": alerts,
        "alertas_blocking": blocking,
        "nivel_maximo": nivel_max,
        "mensaje": "OK" if puede else (f"BLOQUEADO: {len(blocking)} alerta(s) bloqueante(s)" if blocking else f"ADVERTENCIA: {len(alerts)} alerta(s)"),
    }


# OBRAS SOCIALES

async def calculate_insurance_price(db, company_id, obra_social_id, medication_id, cantidad, precio_unitario_pyg):
    cob_q = select(models.ObraSocialCobertura).where(
        and_(
            models.ObraSocialCobertura.obra_social_id == obra_social_id,
            models.ObraSocialCobertura.medication_id == medication_id,
            models.ObraSocialCobertura.activo == True,
        )
    )
    r = await db.execute(cob_q)
    cob = r.scalar_one_or_none()
    fuente = "especifica"
    cobertura_pct = Decimal("0")
    copago = Decimal("0")
    requiere_autorizacion = False

    if cob:
        cobertura_pct = cob.cobertura_pct
        copago = cob.copago_fijo_pyg or Decimal("0")
        requiere_autorizacion = cob.requiere_autorizacion or False
    else:
        os_q = select(models.ObraSocial).where(models.ObraSocial.id == obra_social_id)
        r2 = await db.execute(os_q)
        os_obj = r2.scalar_one_or_none()
        if os_obj:
            cobertura_pct = os_obj.cobertura_default_pct or Decimal("0")
            requiere_autorizacion = os_obj.requiere_autorizacion or False
        fuente = "default_os"

    subtotal = precio_unitario_pyg * cantidad
    monto_os = (subtotal * cobertura_pct / Decimal("100")).quantize(Decimal("1"))
    monto_paciente = max(subtotal - monto_os, Decimal("0"))
    if copago > 0:
        monto_paciente = max(monto_paciente, copago)
        monto_os = subtotal - monto_paciente

    return {
        "precio_unitario_pyg": precio_unitario_pyg,
        "cantidad": cantidad,
        "subtotal_pyg": subtotal.quantize(Decimal("1")),
        "cobertura_pct": cobertura_pct,
        "monto_os_pyg": monto_os.quantize(Decimal("1")),
        "monto_paciente_pyg": monto_paciente.quantize(Decimal("1")),
        "copago_fijo_pyg": copago if copago > 0 else None,
        "requiere_autorizacion": requiere_autorizacion,
        "fuente": fuente,
    }


async def aging_cuentas_corrientes(db, company_id):
    today = date.today()
    q = select(models.CuentaCorrienteOS).where(
        and_(
            models.CuentaCorrienteOS.company_id == company_id,
            models.CuentaCorrienteOS.estado.in_(["pendiente", "enviada", "vencida", "pago_parcial"]),
        )
    )
    r = await db.execute(q)
    buckets = {
        "0_30": {"count": 0, "monto_total": Decimal("0"), "monto_cobrado": Decimal("0")},
        "31_60": {"count": 0, "monto_total": Decimal("0"), "monto_cobrado": Decimal("0")},
        "61_90": {"count": 0, "monto_total": Decimal("0"), "monto_cobrado": Decimal("0")},
        "mas_90": {"count": 0, "monto_total": Decimal("0"), "monto_cobrado": Decimal("0")},
    }
    total = Decimal("0")
    total_cobrado = Decimal("0")
    for cta in r.scalars().all():
        if not cta.fecha_vencimiento:
            continue
        dias = (today - cta.fecha_vencimiento).days
        if dias <= 30:
            bucket = "0_30"
        elif dias <= 60:
            bucket = "31_60"
        elif dias <= 90:
            bucket = "61_90"
        else:
            bucket = "mas_90"
        buckets[bucket]["count"] += 1
        buckets[bucket]["monto_total"] += (cta.monto_os_pyg - cta.monto_cobrado_pyg)
        total += cta.monto_os_pyg
        total_cobrado += cta.monto_cobrado_pyg
    for b in buckets.values():
        b["monto_total"] = b["monto_total"].quantize(Decimal("1"))
    return {
        "buckets": buckets,
        "total_pendiente": total.quantize(Decimal("1")),
        "total_cobrado": total_cobrado.quantize(Decimal("1")),
        "total_general": total.quantize(Decimal("1")),
        "as_of": today.isoformat(),
    }


async def generar_factura_mensual_os(db, company_id, obra_social_id, anio, mes):
    _, last_day = monthrange(anio, mes)
    fecha_inicio = date(anio, mes, 1)
    fecha_fin = date(anio, mes, last_day)

    q = select(func.sum(models.CuentaCorrienteOS.monto_os_pyg - models.CuentaCorrienteOS.monto_cobrado_pyg), func.count()).where(
        and_(
            models.CuentaCorrienteOS.company_id == company_id,
            models.CuentaCorrienteOS.obra_social_id == obra_social_id,
            models.CuentaCorrienteOS.fecha_emision >= fecha_inicio,
            models.CuentaCorrienteOS.fecha_emision <= fecha_fin,
            models.CuentaCorrienteOS.estado.in_(["pendiente", "enviada"]),
        )
    )
    r = await db.execute(q)
    total, count = r.one()
    if not total or total == 0:
        return {"error": "No hay cuentas corrientes en el periodo"}

    os_q = select(models.ObraSocial).where(models.ObraSocial.id == obra_social_id)
    r2 = await db.execute(os_q)
    os_obj = r2.scalar_one_or_none()
    if not os_obj:
        return {"error": "Obra social no encontrada"}

    num_factura = f"F-{str(obra_social_id)[:6]}-{anio}{mes:02d}-{secrets.token_hex(3).upper()}"

    factura = models.FacturaOS(
        company_id=company_id,
        obra_social_id=obra_social_id,
        periodo_anio=anio,
        periodo_mes=mes,
        numero_factura=num_factura,
        fecha_emision=date.today(),
        fecha_vencimiento=date.today() + timedelta(days=os_obj.plazo_pago_dias or 30),
        cantidad_items=count or 0,
        monto_total_pyg=total,
    )
    db.add(factura)
    await db.flush()

    update_q = select(models.CuentaCorrienteOS).where(
        and_(
            models.CuentaCorrienteOS.company_id == company_id,
            models.CuentaCorrienteOS.obra_social_id == obra_social_id,
            models.CuentaCorrienteOS.fecha_emision >= fecha_inicio,
            models.CuentaCorrienteOS.fecha_emision <= fecha_fin,
            models.CuentaCorrienteOS.estado.in_(["pendiente", "enviada"]),
        )
    )
    r3 = await db.execute(update_q)
    for cta in r3.scalars().all():
        cta.estado = "enviada"
    await db.commit()

    return {
        "factura_id": str(factura.id),
        "numero_factura": num_factura,
        "monto_total_pyg": float(total),
        "items_count": count,
        "fecha_vencimiento": str(factura.fecha_vencimiento),
        "estado": factura.estado,
    }


# DINALFA PDF

def _sign_pdf(pdf_bytes, secret):
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    hmac_sig = hmac.new(secret.encode(), pdf_bytes, hashlib.sha256).hexdigest()
    return sha, hmac_sig


async def generar_dinalfa_pdf(db, company_id, anio, mes):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    except ImportError:
        raise HTTPException(500, "reportlab no instalado")

    fecha_inicio = date(anio, mes, 1)
    _, last_day = monthrange(anio, mes)
    fecha_fin = date(anio, mes, last_day)

    q = (
        select(models.LibroPsicotropicos, models.Medication, models.ActiveIngredient)
        .join(models.Medication, models.LibroPsicotropicos.medication_id == models.Medication.id)
        .join(models.ActiveIngredient, models.Medication.principio_activo_id == models.ActiveIngredient.id)
        .where(
            and_(
                models.LibroPsicotropicos.company_id == company_id,
                models.LibroPsicotropicos.created_at >= fecha_inicio,
                models.LibroPsicotropicos.created_at <= datetime.combine(fecha_fin, datetime.max.time(), tzinfo=timezone.utc),
            )
        )
        .order_by(models.LibroPsicotropicos.created_at)
    )
    r = await db.execute(q)
    rows = r.all()

    by_cat = {}
    for lib, med, pa in rows:
        cat = pa.categoria_controlado or "libre"
        by_cat.setdefault(cat, []).append((lib, med, pa))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph(f"<b>REPORTE DINALFA - {anio}/{mes:02d}</b>", styles["Title"]))
    story.append(Paragraph(f"Company: {company_id}", styles["Normal"]))
    story.append(Paragraph(f"Generado: {_now().strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]))
    story.append(Spacer(1, 12))

    totales = {}
    for cat, items in by_cat.items():
        story.append(Paragraph(f"<b>Categoria: {cat}</b>", styles["Heading2"]))
        data = [["Fecha", "Medicamento", "DCI", "Movimiento", "Cantidad", "Receta", "Medico"]]
        entradas = Decimal("0")
        salidas = Decimal("0")
        for lib, med, pa in items:
            qty = lib.cantidad
            data.append([
                lib.created_at.strftime("%Y-%m-%d"),
                med.marca_comercial or pa.nombre,
                pa.nombre,
                lib.tipo_movimiento,
                str(qty),
                lib.receta_numero or "-",
                lib.receta_medico_nombre or "-",
            ])
            if "entrada" in lib.tipo_movimiento:
                entradas += qty
            elif "salida" in lib.tipo_movimiento:
                salidas += qty
        t = Table(data)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.black),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))
        saldo = entradas - salidas
        story.append(Paragraph(f"<b>Entradas: {entradas} | Salidas: {salidas} | Saldo: {saldo}</b>", styles["Normal"]))
        story.append(Spacer(1, 12))
        totales[cat] = {
            "entradas": float(entradas),
            "salidas": float(salidas),
            "saldo": float(saldo),
            "items": len(items),
        }

    doc.build(story)
    pdf_bytes = buf.getvalue()
    secret = f"{company_id}-dinalfa-signer"
    sha, hmac_sig = _sign_pdf(pdf_bytes, secret)

    save_dir = f"/tmp/dinalfa/{company_id}"
    os.makedirs(save_dir, exist_ok=True)
    pdf_path = f"{save_dir}/dinalfa_{anio}_{mes:02d}.pdf"
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)

    qr_token = secrets.token_urlsafe(16)

    for cat, tot in totales.items():
        rep_q = select(models.DinalfaReport).where(
            and_(
                models.DinalfaReport.company_id == company_id,
                models.DinalfaReport.periodo_anio == anio,
                models.DinalfaReport.periodo_mes == mes,
                models.DinalfaReport.categoria_controlado == cat,
            )
        )
        r2 = await db.execute(rep_q)
        rep = r2.scalar_one_or_none()
        if not rep:
            rep = models.DinalfaReport(
                company_id=company_id,
                periodo_anio=anio,
                periodo_mes=mes,
                categoria_controlado=cat,
            )
            db.add(rep)
        rep.total_entradas = Decimal(str(tot["entradas"]))
        rep.total_salidas = Decimal(str(tot["salidas"]))
        rep.saldo_final = Decimal(str(tot["saldo"]))
        rep.total_movimientos = tot["items"]
        rep.pdf_url = pdf_path
        rep.pdf_hash_sha256 = sha
        rep.firma_digital = hmac_sig
        rep.firmado_at = _now()
        rep.qr_verificacion = qr_token
    await db.commit()

    return {
        "pdf_url": pdf_path,
        "pdf_hash_sha256": sha,
        "firma_digital": hmac_sig,
        "qr_verificacion": qr_token,
        "totales": totales,
        "periodo": f"{anio}-{mes:02d}",
    }


# COLD CHAIN

async def check_cold_chain_alerts(db, company_id):
    try:
        from api.src.cold_chain.models import ColdSensor, SensorReading
    except ImportError:
        return []

    sens_q = select(ColdSensor).where(and_(ColdSensor.company_id == company_id, ColdSensor.is_active == True))
    r = await db.execute(sens_q)
    sensors = r.scalars().all()

    alerts = []
    for s in sensors:
        last_q = select(SensorReading).where(SensorReading.sensor_id == s.id).order_by(desc(SensorReading.timestamp)).limit(1)
        r2 = await db.execute(last_q)
        last = r2.scalar_one_or_none()
        if not last:
            continue
        if s.temp_min and s.temp_max and (float(last.temperatura) < float(s.temp_min) or float(last.temperatura) > float(s.temp_max)):
            import uuid as _uuid
            alerts.append({
                "log_id": str(_uuid.uuid4()),
                "sensor_id": s.sensor_id,
                "temperatura": float(last.temperatura),
                "temp_min": float(s.temp_min),
                "temp_max": float(s.temp_max),
                "tiempo_fuera_minutos": 0,
                "ubicacion": s.ubicacion,
                "created_at": last.timestamp.isoformat() if last.timestamp else None,
                "medication_nombre": None,
                "medication_id": None,
                "product_id": None,
            })
    return alerts


# DISPENSAR POS

async def dispensar_pos(db, company_id, user_id, data):
    if not data.items:
        raise HTTPException(400, "No hay items para dispensar")

    med_ids = [i.medication_id for i in data.items]
    med_q = select(models.Medication).where(models.Medication.id.in_(med_ids))
    r = await db.execute(med_q)
    meds = {m.id: m for m in r.scalars().all()}
    new_pa_ids = list({m.principio_activo_id for m in meds.values()})

    safety = await check_safety(db, company_id, data.paciente_id, new_pa_ids)

    if not safety["puede_dispensar"] and not data.forzar_dispensacion:
        return {
            "dispensaciones": [],
            "alertas_safety": safety["alertas"],
            "alertas_blocking": safety["alertas_blocking"],
            "total_pyg": Decimal("0"),
            "total_os_pyg": Decimal("0"),
            "total_paciente_pyg": Decimal("0"),
            "puede_dispensar": False,
            "mensaje": f"BLOQUEADO: {len(safety['alertas_blocking'])} alerta(s). Use forzar_dispensacion=true solo con justificacion medica.",
            "sale_id": None,
            "cuentas_corrientes_generadas": [],
        }

    paciente = None
    if data.paciente_id:
        pac_q = select(models.Paciente).where(models.Paciente.id == data.paciente_id)
        r = await db.execute(pac_q)
        paciente = r.scalar_one_or_none()

    dispensaciones = []
    total_pyg = Decimal("0")
    total_os = Decimal("0")
    total_pac = Decimal("0")
    ctas_generadas = []

    receta_id = data.receta_id
    if not receta_id and data.items:
        rec = models.Receta(
            company_id=company_id,
            paciente_id=data.paciente_id,
            customer_id=data.customer_id,
            medico_nombre="(Autogenerada POS)",
            fecha_emision=date.today(),
            fecha_vencimiento=date.today() + timedelta(days=30),
            tipo_receta="receta_simple",
            items=[i.model_dump(mode="json") for i in data.items],
            estado="dispensada",
        )
        db.add(rec)
        await db.flush()
        receta_id = rec.id

    for item in data.items:
        med = meds.get(item.medication_id)
        if not med:
            continue

        if data.obra_social_id or (paciente and paciente.obra_social_id):
            os_id = data.obra_social_id or paciente.obra_social_id
            pricing = await calculate_insurance_price(
                db, company_id, os_id, item.medication_id, item.cantidad, item.precio_unitario_pyg
            )
        else:
            subtotal = item.precio_unitario_pyg * item.cantidad
            pricing = {
                "precio_unitario_pyg": item.precio_unitario_pyg,
                "cantidad": item.cantidad,
                "subtotal_pyg": subtotal.quantize(Decimal("1")),
                "cobertura_pct": Decimal("0"),
                "monto_os_pyg": Decimal("0"),
                "monto_paciente_pyg": subtotal.quantize(Decimal("1")),
                "copago_fijo_pyg": None,
                "requiere_autorizacion": False,
                "fuente": "particular",
            }

        disp = models.Dispensacion(
            company_id=company_id,
            receta_id=receta_id,
            paciente_id=data.paciente_id,
            medication_id=item.medication_id,
            product_id=item.product_id,
            lote_id=item.lote_id,
            cantidad=item.cantidad,
            dosis=item.dosis,
            duracion_dias=item.duracion_dias,
            posologia=item.posologia,
            precio_unitario_pyg=pricing["precio_unitario_pyg"],
            subtotal_pyg=pricing["subtotal_pyg"],
            cobertura_pct=pricing["cobertura_pct"],
            monto_os_pyg=pricing["monto_os_pyg"],
            monto_paciente_pyg=pricing["monto_paciente_pyg"],
            alertas_safety=safety["alertas"],
            farmaceutico_user_id=user_id,
            observaciones=data.observaciones,
        )
        db.add(disp)

        hist = models.PacienteHistorial(
            company_id=company_id,
            customer_id=data.customer_id,
            paciente_id=data.paciente_id,
            medication_id=item.medication_id,
            product_id=item.product_id,
            cantidad=item.cantidad,
            posologia=item.posologia,
            duracion_dias=item.duracion_dias,
            proxima_dispensacion_esperada=date.today() + timedelta(days=item.duracion_dias or 30) if item.duracion_dias else None,
            dias_sin_reposicion=0,
            adherencia_pct=Decimal("100"),
        )
        db.add(hist)

        if pricing["monto_os_pyg"] > 0 and (data.obra_social_id or (paciente and paciente.obra_social_id)):
            os_id = data.obra_social_id or paciente.obra_social_id
            cta = models.CuentaCorrienteOS(
                company_id=company_id,
                obra_social_id=os_id,
                paciente_id=data.paciente_id,
                prescription_id=receta_id,
                fecha_emision=date.today(),
                fecha_vencimiento=date.today() + timedelta(days=30),
                monto_total_pyg=pricing["subtotal_pyg"],
                cobertura_pct=pricing["cobertura_pct"],
                monto_os_pyg=pricing["monto_os_pyg"],
                monto_copago_pyg=pricing["monto_paciente_pyg"],
            )
            db.add(cta)
            ctas_generadas.append(cta)

        if med.es_controlado:
            lib = models.LibroPsicotropicos(
                company_id=company_id,
                medication_id=med.id,
                product_id=item.product_id,
                prescription_id=receta_id,
                cantidad=item.cantidad,
                tipo_movimiento="salida_venta",
                lote=item.lote_id,
                paciente_nombre=paciente.nombre if paciente else None,
                paciente_ci=paciente.cedula if paciente else None,
                user_id=user_id,
            )
            db.add(lib)

        dispensaciones.append(disp)
        total_pyg += pricing["subtotal_pyg"]
        total_os += pricing["monto_os_pyg"]
        total_pac += pricing["monto_paciente_pyg"]

    await db.commit()

    return {
        "dispensaciones": dispensaciones,
        "alertas_safety": safety["alertas"],
        "alertas_blocking": safety["alertas_blocking"],
        "total_pyg": total_pyg.quantize(Decimal("1")),
        "total_os_pyg": total_os.quantize(Decimal("1")),
        "total_paciente_pyg": total_pac.quantize(Decimal("1")),
        "puede_dispensar": True,
        "mensaje": f"OK: {len(dispensaciones)} dispensacion(es) procesadas",
        "sale_id": None,
        "cuentas_corrientes_generadas": ctas_generadas,
    }


# CRUD helpers

async def list_medications(db, company_id, q=None, forma=None, limit=100):
    stmt = select(models.Medication, models.ActiveIngredient).join(
        models.ActiveIngredient, models.Medication.principio_activo_id == models.ActiveIngredient.id
    ).where(and_(models.Medication.company_id == company_id, models.Medication.activo == True))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            models.Medication.marca_comercial.ilike(like),
            models.ActiveIngredient.nombre.ilike(like),
        ))
    if forma:
        stmt = stmt.where(models.Medication.forma_farmaceutica == forma)
    stmt = stmt.limit(limit)
    r = await db.execute(stmt)
    return [{
        "id": str(m.id),
        "marca_comercial": m.marca_comercial,
        "principio_activo": pa.nombre,
        "principio_activo_id": str(pa.id),
        "concentracion": m.concentracion,
        "forma_farmaceutica": m.forma_farmaceutica,
        "laboratorio": m.laboratorio,
        "es_generico": m.es_generico,
        "es_controlado": m.es_controlado,
        "categoria_controlado": m.categoria_controlado,
        "requiere_cadena_frio": m.requiere_cadena_frio,
    } for m, pa in r.all()]


async def list_pacientes(db, company_id, q=None, limit=100):
    stmt = select(models.Paciente).where(and_(models.Paciente.company_id == company_id, models.Paciente.activo == True))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(models.Paciente.nombre.ilike(like), models.Paciente.cedula.ilike(like)))
    stmt = stmt.limit(limit)
    r = await db.execute(stmt)
    return [{
        "id": str(p.id),
        "cedula": p.cedula,
        "nombre": p.nombre,
        "edad": (date.today() - p.fecha_nacimiento).days // 365 if p.fecha_nacimiento else None,
        "sexo": p.sexo,
        "obra_social_id": str(p.obra_social_id) if p.obra_social_id else None,
    } for p in r.scalars().all()]


async def list_obras_sociales(db, company_id):
    stmt = select(models.ObraSocial).where(and_(models.ObraSocial.company_id == company_id, models.ObraSocial.activo == True))
    r = await db.execute(stmt)
    return [{
        "id": str(o.id),
        "nombre": o.nombre,
        "codigo": o.codigo,
        "tipo": o.tipo,
        "cobertura_default_pct": float(o.cobertura_default_pct) if o.cobertura_default_pct else 0,
        "plazo_pago_dias": o.plazo_pago_dias,
    } for o in r.scalars().all()]


async def list_medicos(db, company_id, q=None):
    stmt = select(models.Medico).where(and_(models.Medico.company_id == company_id, models.Medico.activo == True))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(models.Medico.nombre.ilike(like), models.Medico.matricula.ilike(like)))
    r = await db.execute(stmt)
    return [{
        "id": str(m.id),
        "nombre": m.nombre,
        "matricula": m.matricula,
        "especialidad": m.especialidad,
        "verificado": m.verificado,
    } for m in r.scalars().all()]


async def list_recetas(db, company_id, estado=None, limit=100):
    stmt = select(models.Receta).where(and_(models.Receta.company_id == company_id, models.Receta.activo == True))
    if estado:
        stmt = stmt.where(models.Receta.estado == estado)
    stmt = stmt.order_by(desc(models.Receta.created_at)).limit(limit)
    r = await db.execute(stmt)
    return [{
        "id": str(rc.id),
        "medico_nombre": rc.medico_nombre,
        "medico_matricula": rc.medico_matricula,
        "fecha_emision": rc.fecha_emision.isoformat() if rc.fecha_emision else None,
        "fecha_vencimiento": rc.fecha_vencimiento.isoformat() if rc.fecha_vencimiento else None,
        "es_controlada": rc.es_controlada,
        "estado": rc.estado,
        "numero_receta": rc.numero_receta,
    } for rc in r.scalars().all()]


async def list_libro_psicotropicos(db, company_id, categoria=None, limit=100):
    stmt = (
        select(models.LibroPsicotropicos, models.Medication, models.ActiveIngredient)
        .join(models.Medication, models.LibroPsicotropicos.medication_id == models.Medication.id)
        .join(models.ActiveIngredient, models.Medication.principio_activo_id == models.ActiveIngredient.id)
        .where(models.LibroPsicotropicos.company_id == company_id)
    )
    if categoria:
        stmt = stmt.where(models.ActiveIngredient.categoria_controlado == categoria)
    stmt = stmt.order_by(desc(models.LibroPsicotropicos.created_at)).limit(limit)
    r = await db.execute(stmt)
    return [{
        "id": str(lib.id),
        "fecha": lib.created_at.isoformat() if lib.created_at else None,
        "medicamento": med.marca_comercial or pa.nombre,
        "principio_activo": pa.nombre,
        "categoria_controlado": pa.categoria_controlado,
        "cantidad": float(lib.cantidad),
        "tipo_movimiento": lib.tipo_movimiento,
        "patient_nombre": lib.patient_nombre,
        "patient_ci": lib.patient_ci,
        "receta_numero": lib.receta_numero,
        "receta_medico_nombre": lib.receta_medico_nombre,
        "reportado_dinalfa": lib.reportado_dinalfa,
    } for lib, med, pa in r.all()]


async def list_vencimientos(db, company_id, alerta_tipo=None, resuelto=False, limit=200):
    stmt = select(models.ExpirationAlert).where(
        and_(
            models.ExpirationAlert.company_id == company_id,
            models.ExpirationAlert.resuelto == resuelto,
        )
    )
    if alerta_tipo:
        stmt = stmt.where(models.ExpirationAlert.alerta_tipo == alerta_tipo)
    stmt = stmt.order_by(models.ExpirationAlert.fecha_vencimiento).limit(limit)
    r = await db.execute(stmt)
    return [{
        "id": str(a.id),
        "product_id": str(a.product_id),
        "medication_id": str(a.medication_id) if a.medication_id else None,
        "lote": a.lote,
        "fecha_vencimiento": a.fecha_vencimiento.isoformat() if a.fecha_vencimiento else None,
        "cantidad": a.cantidad,
        "alerta_tipo": a.alerta_tipo,
        "dias_restantes": a.dias_restantes,
        "notificado": a.notificado,
        "resuelto": a.resuelto,
    } for a in r.scalars().all()]


# DASHBOARD

async def build_dashboard(db, company_id):
    today = date.today()
    kpis = {}

    r = await db.execute(select(func.count(models.Medication.id)).where(models.Medication.company_id == company_id, models.Medication.activo == True))
    kpis["total_medicamentos"] = r.scalar() or 0

    r = await db.execute(select(func.count(models.Paciente.id)).where(models.Paciente.company_id == company_id, models.Paciente.activo == True))
    kpis["total_pacientes"] = r.scalar() or 0

    r = await db.execute(select(func.count(models.Dispensacion.id)).where(
        and_(
            models.Dispensacion.company_id == company_id,
            func.date(models.Dispensacion.created_at) == today,
        )
    ))
    kpis["dispensaciones_hoy"] = r.scalar() or 0

    r = await db.execute(select(func.count(models.Receta.id)).where(
        and_(models.Receta.company_id == company_id, models.Receta.estado == "pendiente", models.Receta.activo == True)
    ))
    kpis["recetas_pendientes"] = r.scalar() or 0

    r = await db.execute(select(func.count(models.ExpirationAlert.id)).where(
        and_(models.ExpirationAlert.company_id == company_id, models.ExpirationAlert.resuelto == False)
    ))
    kpis["vencimientos_activos"] = r.scalar() or 0

    r = await db.execute(select(func.count(models.ExpirationAlert.id)).where(
        and_(models.ExpirationAlert.company_id == company_id, models.ExpirationAlert.alerta_tipo == "critico", models.ExpirationAlert.resuelto == False)
    ))
    kpis["vencidos"] = r.scalar() or 0

    r = await db.execute(select(func.count(models.LibroPsicotropicos.id)).where(
        and_(
            models.LibroPsicotropicos.company_id == company_id,
            func.date_trunc("month", models.LibroPsicotropicos.created_at) == func.date_trunc("month", _now()),
        )
    ))
    kpis["movimientos_controlados_mes"] = r.scalar() or 0

    r = await db.execute(
        select(models.Medication.marca_comercial, models.ActiveIngredient.nombre, func.sum(models.Dispensacion.cantidad).label("total"))
        .join(models.Medication, models.Dispensacion.medication_id == models.Medication.id)
        .join(models.ActiveIngredient, models.Medication.principio_activo_id == models.ActiveIngredient.id)
        .where(
            and_(
                models.Dispensacion.company_id == company_id,
                models.Dispensacion.created_at >= _now() - timedelta(days=30),
            )
        )
        .group_by(models.Medication.marca_comercial, models.ActiveIngredient.nombre)
        .order_by(desc("total"))
        .limit(10)
    )
    top_meds = [{"marca": m, "dci": d, "cantidad_total": float(t)} for m, d, t in r.all()]

    aging = await aging_cuentas_corrientes(db, company_id)

    r = await db.execute(
        select(models.ActiveIngredient.categoria_controlado, func.count(models.LibroPsicotropicos.id))
        .join(models.Medication, models.Medication.principio_activo_id == models.ActiveIngredient.id)
        .join(models.LibroPsicotropicos, models.LibroPsicotropicos.medication_id == models.Medication.id)
        .where(models.LibroPsicotropicos.company_id == company_id)
        .group_by(models.ActiveIngredient.categoria_controlado)
    )
    control_summary = {cat: count for cat, count in r.all()}

    cc_alerts = await check_cold_chain_alerts(db, company_id)

    r = await db.execute(
        select(func.count(models.Farmacovigilancia.id))
        .where(
            and_(
                models.Farmacovigilancia.company_id == company_id,
                models.Farmacovigilancia.notificado_dinavisa == False,
            )
        )
    )
    fv_pendientes = r.scalar() or 0

    return {
        "kpis_principales": kpis,
        "top_medicamentos": top_meds,
        "alertas_vencimiento": (await list_vencimientos(db, company_id, limit=10)),
        "alertas_safety_hoy": 0,
        "aging_os": aging,
        "control_summary": {
            "por_categoria": control_summary,
            "total_movimientos_mes": sum(control_summary.values()),
        },
        "cold_chain_summary": {
            "alertas_activas": len(cc_alerts),
            "alertas": cc_alerts[:5],
        },
        "farmacovigilancia_summary": {
            "pendientes_notificar_dinavisa": fv_pendientes,
        },
        "generated_at": _now(),
    }


# CRUD individuales

async def create_medication(db, company_id, data):
    m = models.Medication(company_id=company_id, **data.model_dump())
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


async def create_active_ingredient(db, company_id, data):
    pa = models.ActiveIngredient(company_id=company_id, **data.model_dump())
    db.add(pa)
    await db.commit()
    await db.refresh(pa)
    return pa


async def create_paciente(db, company_id, data):
    p = models.Paciente(company_id=company_id, **data.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def create_medico(db, company_id, data):
    m = models.Medico(company_id=company_id, **data.model_dump())
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


async def create_obra_social(db, company_id, data):
    o = models.ObraSocial(company_id=company_id, **data.model_dump())
    db.add(o)
    await db.commit()
    await db.refresh(o)
    return o


async def create_receta(db, company_id, user_id, data):
    d = data.model_dump()
    items = d.pop("items", [])
    r = models.Receta(company_id=company_id, **d)
    r.items = items
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


async def create_libro_movimiento(db, company_id, user_id, data):
    lib = models.LibroPsicotropicos(company_id=company_id, user_id=user_id, **data.model_dump())
    db.add(lib)
    await db.commit()
    await db.refresh(lib)
    return lib


async def create_destruccion(db, company_id, user_id, data):
    items = [i.model_dump() for i in data.items]
    d_data = data.model_dump(exclude={"items"})
    acta = f"DESTR-{datetime.now().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    d_obj = models.Destruccion(company_id=company_id, user_id=user_id, acta_numero=acta, **d_data)
    db.add(d_obj)
    await db.flush()
    for item in items:
        di = models.DestruccionItem(
            company_id=company_id,
            destruccion_id=d_obj.id,
            **item,
        )
        db.add(di)
    await db.commit()
    await db.refresh(d_obj)
    return d_obj


async def create_farmacovigilancia(db, company_id, user_id, data):
    fv = models.Farmacovigilancia(company_id=company_id, user_id=user_id, **data.model_dump())
    db.add(fv)
    await db.commit()
    await db.refresh(fv)
    return fv


async def create_cobertura(db, company_id, data):
    c = models.ObraSocialCobertura(company_id=company_id, **data.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


async def create_cold_chain_log(db, company_id, user_id, data):
    log = models.ColdChainLog(company_id=company_id, user_id=user_id, **data.model_dump())
    if data.temp_min_esperada is not None and data.temp_max_esperada is not None:
        t = float(data.temperatura)
        if t < float(data.temp_min_esperada) or t > float(data.temp_max_esperada):
            log.fuera_rango = True
            log.alerta_generada = True
            log.alerta_motivo = f"Temp {t} fuera de rango [{data.temp_min_esperada}, {data.temp_max_esperada}]"
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def scan_vencimientos(db, company_id, days_ahead=180):
    try:
        from api.src.inventory.models import StockLot
    except ImportError:
        return {"error": "inventory module not available", "creadas": 0}

    future = date.today() + timedelta(days=days_ahead)
    lot_q = select(StockLot).where(
        and_(
            StockLot.company_id == company_id,
            StockLot.fecha_vencimiento.isnot(None),
            StockLot.fecha_vencimiento <= future,
            StockLot.cantidad > 0,
        )
    )
    r = await db.execute(lot_q)
    created = 0
    for lot in r.scalars().all():
        exists_q = select(models.ExpirationAlert).where(
            and_(
                models.ExpirationAlert.product_id == lot.product_id,
                models.ExpirationAlert.lote == lot.lote,
                models.ExpirationAlert.resuelto == False,
            )
        )
        r2 = await db.execute(exists_q)
        if r2.scalar_one_or_none():
            continue
        dias = (lot.fecha_vencimiento - date.today()).days
        if dias < 0:
            tipo = "critico"
        elif dias <= 30:
            tipo = "proximo"
        elif dias <= 90:
            tipo = "alerta"
        else:
            tipo = "informativo"
        alert = models.ExpirationAlert(
            company_id=company_id,
            product_id=lot.product_id,
            warehouse_id=lot.warehouse_id,
            lote=lot.lote,
            fecha_vencimiento=lot.fecha_vencimiento,
            cantidad=lot.cantidad,
            alerta_tipo=tipo,
            dias_restantes=dias,
        )
        db.add(alert)
        created += 1
    await db.commit()
    return {"creadas": created, "scan_date": _now().isoformat()}
