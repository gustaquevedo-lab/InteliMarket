"""Farmacia router - 50+ endpoints en /api/v1/farmacia/."""
from uuid import UUID
from typing import Optional, List
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy import select, desc, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.farmacia import service, schemas, models

router = APIRouter(prefix="/api/v1/farmacia", tags=["farmacia"])


def _cid(user):
    c = user.get("company_id")
    if c:
        return UUID(str(c))
    return UUID("00000000-0000-0000-0000-000000000010")


# DASHBOARD

@router.get("/dashboard", response_model=schemas.FarmaciaDashboardData)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.build_dashboard(db, _cid(user))


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    dash = await service.build_dashboard(db, _cid(user))
    return dash["kpis_principales"]


# CATALOGO - Principios activos

@router.get("/active-ingredients")
async def list_active_ingredients(
    q: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    stmt = select(models.ActiveIngredient).where(
        models.ActiveIngredient.company_id == _cid(user), models.ActiveIngredient.activo == True
    )
    if q:
        like = f"%{q}%"
        stmt = stmt.where(models.ActiveIngredient.nombre.ilike(like))
    stmt = stmt.limit(limit)
    r = await db.execute(stmt)
    return [{
        "id": str(p.id),
        "nombre": p.nombre,
        "nombre_comun": p.nombre_comun,
        "codigo_atc": p.codigo_atc,
        "categoria": p.categoria,
        "embarazo_categoria": p.embarazo_categoria,
        "es_controlado": p.es_controlado,
        "categoria_controlado": p.categoria_controlado,
    } for p in r.scalars().all()]


@router.post("/active-ingredients", response_model=schemas.ActiveIngredientResponse)
async def create_active_ingredient(
    data: schemas.ActiveIngredientCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_active_ingredient(db, _cid(user), data)


# CATALOGO - Medicamentos

@router.get("/medications")
async def list_medications(
    q: Optional[str] = Query(None),
    forma: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_medications(db, _cid(user), q, forma, limit)


@router.post("/medications", response_model=schemas.MedicationResponse)
async def create_medication(
    data: schemas.MedicationCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_medication(db, _cid(user), data)


@router.get("/medications/{medication_id}", response_model=schemas.MedicationResponse)
async def get_medication(
    medication_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    stmt = (
        select(models.Medication, models.ActiveIngredient)
        .join(models.ActiveIngredient, models.Medication.principio_activo_id == models.ActiveIngredient.id)
        .where(models.Medication.id == medication_id)
    )
    r = await db.execute(stmt)
    row = r.first()
    if not row:
        raise HTTPException(404, "Medicamento no encontrado")
    m, pa = row
    return schemas.MedicationResponse(
        id=m.id, company_id=m.company_id, product_id=m.product_id, principio_activo_id=m.principio_activo_id,
        concentracion=m.concentracion, concentracion_numerica=m.concentracion_numerica,
        concentracion_unidad=m.concentracion_unidad, forma_farmaceutica=m.forma_farmaceutica,
        via_administracion=m.via_administracion, troquel=m.troquel, registro_sanitario=m.registro_sanitario,
        laboratorio=m.laboratorio, marca_comercial=m.marca_comercial, es_generico=m.es_generico,
        es_referencia=m.es_referencia, es_controlado=m.es_controlado, categoria_controlado=m.categoria_controlado,
        requiere_receta_retencion=m.requiere_receta_retencion, requiere_cadena_frio=m.requiere_cadena_frio,
        temp_min=m.temp_min, temp_max=m.temp_max, protege_luz=m.protege_luz,
        posologia_habitual=m.posologia_habitual, contraindicaciones=m.contraindicaciones,
        efectos_adversos=m.efectos_adversos, activo=m.activo, created_at=m.created_at, updated_at=m.updated_at,
        principio_activo_nombre=pa.nombre,
    )


# EQUIVALENTES

@router.get("/medications/{medication_id}/equivalents")
async def get_equivalents(
    medication_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    stmt = select(models.MedicationEquivalent).where(
        or_(
            models.MedicationEquivalent.medication_id == medication_id,
            models.MedicationEquivalent.equivalent_medication_id == medication_id,
        )
    )
    r = await db.execute(stmt)
    return [{
        "id": str(eq.id),
        "medication_id": str(eq.medication_id),
        "equivalent_medication_id": str(eq.equivalent_medication_id),
        "tipo": eq.tipo,
        "diferencia_precio_pct": float(eq.diferencia_precio_pct) if eq.diferencia_precio_pct else None,
        "sustitucion_automatica": eq.sustitucion_automatica,
    } for eq in r.scalars().all()]


# SAFETY

@router.post("/safety/check", response_model=schemas.SafetyCheckResponse)
async def safety_check(
    data: schemas.SafetyCheckRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.check_safety(
        db, _cid(user), data.paciente_id, data.principio_activo_ids, data.otros_medicamentos_paciente
    )


# PACIENTES

@router.get("/pacientes")
async def list_pacientes(
    q: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_pacientes(db, _cid(user), q, limit)


@router.post("/pacientes", response_model=schemas.PacienteResponse)
async def create_paciente(
    data: schemas.PacienteCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_paciente(db, _cid(user), data)


@router.get("/pacientes/{paciente_id}")
async def get_paciente(
    paciente_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    stmt = select(models.Paciente).where(models.Paciente.id == paciente_id)
    r = await db.execute(stmt)
    p = r.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Paciente no encontrado")
    edad = (date.today() - p.fecha_nacimiento).days // 365 if p.fecha_nacimiento else None
    return {
        "id": str(p.id),
        "cedula": p.cedula,
        "nombre": p.nombre,
        "fecha_nacimiento": p.fecha_nacimiento,
        "edad": edad,
        "sexo": p.sexo,
        "peso_kg": float(p.peso_kg) if p.peso_kg else None,
        "altura_cm": float(p.altura_cm) if p.altura_cm else None,
        "embarazada": p.embarazada,
        "lactando": p.lactando,
        "insuficiencia_renal": p.insuficiencia_renal,
        "tfg_ml_min": float(p.tfg_ml_min) if p.tfg_ml_min else None,
        "condiciones_cronicas": p.condiciones_cronicas or [],
        "obra_social_id": str(p.obra_social_id) if p.obra_social_id else None,
        "telefono": p.telefono,
        "email": p.email,
    }


@router.post("/pacientes/{paciente_id}/alergias")
async def add_alergia(
    paciente_id: UUID,
    data: schemas.AlergiaCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    a = models.AlergiaPaciente(company_id=_cid(user), **data.model_dump())
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return {"id": str(a.id), "ok": True}


# MEDICOS

@router.get("/medicos")
async def list_medicos(
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_medicos(db, _cid(user), q)


@router.post("/medicos", response_model=schemas.MedicoResponse)
async def create_medico(
    data: schemas.MedicoCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_medico(db, _cid(user), data)


# OBRAS SOCIALES

@router.get("/obras-sociales")
async def list_obras_sociales(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_obras_sociales(db, _cid(user))


@router.post("/obras-sociales", response_model=schemas.ObraSocialResponse)
async def create_obra_social(
    data: schemas.ObraSocialCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_obra_social(db, _cid(user), data)


@router.post("/obras-sociales/calcular-precio", response_model=schemas.PriceCalcResponse)
async def calcular_precio(
    data: schemas.PriceCalcRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.calculate_insurance_price(
        db, _cid(user), data.obra_social_id, data.medication_id, data.cantidad, data.precio_unitario_pyg
    )


@router.get("/obras-sociales/aging")
async def get_aging(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.aging_cuentas_corrientes(db, _cid(user))


@router.post("/obras-sociales/{obra_social_id}/facturar/{anio}/{mes}")
async def facturar_mensual(
    obra_social_id: UUID,
    anio: int = Path(..., ge=2000, le=2100),
    mes: int = Path(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.generar_factura_mensual_os(db, _cid(user), obra_social_id, anio, mes)


@router.post("/obras-sociales/cobertura", response_model=schemas.CoberturaResponse)
async def create_cobertura(
    data: schemas.CoberturaCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_cobertura(db, _cid(user), data)


@router.get("/cuentas-corrientes")
async def list_cuentas_corrientes(
    estado: Optional[str] = Query(None),
    obra_social_id: Optional[UUID] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    stmt = select(models.CuentaCorrienteOS).where(models.CuentaCorrienteOS.company_id == _cid(user))
    if estado:
        stmt = stmt.where(models.CuentaCorrienteOS.estado == estado)
    if obra_social_id:
        stmt = stmt.where(models.CuentaCorrienteOS.obra_social_id == obra_social_id)
    stmt = stmt.order_by(desc(models.CuentaCorrienteOS.fecha_emision)).limit(limit)
    r = await db.execute(stmt)
    return [{
        "id": str(c.id),
        "obra_social_id": str(c.obra_social_id),
        "paciente_id": str(c.paciente_id) if c.paciente_id else None,
        "numero_comprobante": c.numero_comprobante,
        "fecha_emision": c.fecha_emision.isoformat() if c.fecha_emision else None,
        "fecha_vencimiento": c.fecha_vencimiento.isoformat() if c.fecha_vencimiento else None,
        "monto_total_pyg": float(c.monto_total_pyg),
        "monto_os_pyg": float(c.monto_os_pyg),
        "monto_copago_pyg": float(c.monto_copago_pyg),
        "monto_cobrado_pyg": float(c.monto_cobrado_pyg or 0),
        "estado": c.estado,
        "dias_mora": c.dias_mora,
    } for c in r.scalars().all()]


# RECETAS

@router.get("/recetas")
async def list_recetas(
    estado: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_recetas(db, _cid(user), estado, limit)


@router.post("/recetas", response_model=schemas.RecetaResponse)
async def create_receta(
    data: schemas.RecetaCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user["id"]) if user.get("id") else None
    return await service.create_receta(db, _cid(user), user_id, data)


@router.get("/recetas/{receta_id}", response_model=schemas.RecetaResponse)
async def get_receta(
    receta_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    stmt = select(models.Receta).where(models.Receta.id == receta_id)
    r = await db.execute(stmt)
    rc = r.scalar_one_or_none()
    if not rc:
        raise HTTPException(404, "Receta no encontrada")
    return rc


# POS - DISPENSAR

@router.post("/dispensar", response_model=schemas.POSDispensarResponse)
async def dispensar(
    data: schemas.POSDispensarRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user["id"]) if user.get("id") else None
    return await service.dispensar_pos(db, _cid(user), user_id, data)


# CONTROLADOS - Libro psicotropicos

@router.get("/libro-psicotropicos")
async def list_libro(
    categoria: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_libro_psicotropicos(db, _cid(user), categoria, limit)


@router.post("/libro-psicotropicos", response_model=schemas.LibroPsicotropicoResponse)
async def create_libro_mov(
    data: schemas.LibroPsicotropicoCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user["id"]) if user.get("id") else None
    return await service.create_libro_movimiento(db, _cid(user), user_id, data)


# DINALFA

@router.post("/dinalfa/generar/{anio}/{mes}")
async def generar_dinalfa(
    anio: int = Path(..., ge=2000, le=2100),
    mes: int = Path(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.generar_dinalfa_pdf(db, _cid(user), anio, mes)


@router.get("/dinalfa/reportes")
async def list_dinalfa_reportes(
    anio: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    stmt = select(models.DinalfaReport).where(models.DinalfaReport.company_id == _cid(user))
    if anio:
        stmt = stmt.where(models.DinalfaReport.periodo_anio == anio)
    stmt = stmt.order_by(desc(models.DinalfaReport.periodo_anio), desc(models.DinalfaReport.periodo_mes))
    r = await db.execute(stmt)
    return [{
        "id": str(rep.id),
        "periodo": f"{rep.periodo_anio}-{rep.periodo_mes:02d}",
        "categoria_controlado": rep.categoria_controlado,
        "total_entradas": float(rep.total_entradas or 0),
        "total_salidas": float(rep.total_salidas or 0),
        "saldo_final": float(rep.saldo_final or 0),
        "total_movimientos": rep.total_movimientos,
        "pdf_url": rep.pdf_url,
        "pdf_hash_sha256": rep.pdf_hash_sha256,
        "firmado_at": rep.firmado_at.isoformat() if rep.firmado_at else None,
        "presentado": rep.presentado,
        "numero_recibido_dinavisa": rep.numero_recibido_dinavisa,
    } for rep in r.scalars().all()]


# ARQUEOS

@router.post("/arqueos", response_model=schemas.ArqueoResponse)
async def create_arqueo(
    data: schemas.ArqueoCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user["id"]) if user.get("id") else None
    diff = float(data.stock_fisico) - 0
    a = models.ArqueoControlado(
        company_id=_cid(user),
        medication_id=data.medication_id,
        fecha_arqueo=data.fecha_arqueo,
        stock_sistema=0,
        stock_fisico=data.stock_fisico,
        diferencia=diff,
        motivo_diferencia=data.motivo_diferencia,
        user_id=user_id,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


# DESTRUCCION

@router.post("/destrucciones", response_model=schemas.DestruccionResponse)
async def create_destruccion(
    data: schemas.DestruccionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user["id"]) if user.get("id") else None
    d = await service.create_destruccion(db, _cid(user), user_id, data)
    return {
        "id": str(d.id),
        "company_id": str(d.company_id),
        "fecha_destruccion": d.fecha_destruccion,
        "motivo": d.motivo,
        "metodo": d.metodo,
        "acta_numero": d.acta_numero,
        "autoridad": d.autoridad,
        "responsable_nombre": d.responsable_nombre,
        "created_at": d.created_at,
        "items_count": len(d.items),
    }


# VENCIMIENTOS

@router.get("/vencimientos/alertas")
async def list_alertas_vencimiento(
    alerta_tipo: Optional[str] = Query(None),
    resuelto: bool = Query(False),
    limit: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_vencimientos(db, _cid(user), alerta_tipo, resuelto, limit)


@router.post("/vencimientos/scan")
async def scan_vencimientos(
    dias: int = Query(180, ge=30, le=730),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.scan_vencimientos(db, _cid(user), dias)


@router.patch("/vencimientos/alertas/{alerta_id}/resolver")
async def resolver_alerta(
    alerta_id: UUID,
    motivo: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user["id"]) if user.get("id") else None
    stmt = select(models.ExpirationAlert).where(models.ExpirationAlert.id == alerta_id)
    r = await db.execute(stmt)
    a = r.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Alerta no encontrada")
    a.resuelto = True
    a.resuelto_at = datetime.utcnow()
    a.resuelto_motivo = motivo
    a.resuelto_user_id = user_id
    await db.commit()
    return {"ok": True, "id": str(alerta_id)}


# COLD CHAIN

@router.get("/cold-chain/alertas")
async def get_cold_chain_alertas(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.check_cold_chain_alertas(db, _cid(user)) if hasattr(service, 'check_cold_chain_alertas') else await service.check_cold_chain_alerts(db, _cid(user))


@router.post("/cold-chain/log", response_model=schemas.ColdChainResponse)
async def create_cold_log(
    data: schemas.ColdChainLogCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user["id"]) if user.get("id") else None
    return await service.create_cold_chain_log(db, _cid(user), user_id, data)


@router.get("/cold-chain/logs")
async def list_cold_logs(
    medication_id: Optional[UUID] = Query(None),
    fuera_rango: Optional[bool] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    stmt = select(models.ColdChainLog).where(models.ColdChainLog.company_id == _cid(user))
    if medication_id:
        stmt = stmt.where(models.ColdChainLog.medication_id == medication_id)
    if fuera_rango is not None:
        stmt = stmt.where(models.ColdChainLog.fuera_rango == fuera_rango)
    stmt = stmt.order_by(desc(models.ColdChainLog.created_at)).limit(limit)
    r = await db.execute(stmt)
    return [{
        "id": str(l.id),
        "product_id": str(l.product_id),
        "medication_id": str(l.medication_id) if l.medication_id else None,
        "temperatura": float(l.temperatura),
        "temp_min_esperada": float(l.temp_min_esperada) if l.temp_min_esperada else None,
        "temp_max_esperada": float(l.temp_max_esperada) if l.temp_max_esperada else None,
        "fuera_rango": l.fuera_rango,
        "tipo_registro": l.tipo_registro,
        "sensor_id": l.sensor_id,
        "alerta_generada": l.alerta_generada,
        "alerta_motivo": l.alerta_motivo,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    } for l in r.scalars().all()]


# FARMACOVIGILANCIA

@router.get("/farmacovigilancia")
async def list_farmacovigilancia(
    severidad: Optional[str] = Query(None),
    notificado: Optional[bool] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    stmt = select(models.Farmacovigilancia).where(models.Farmacovigilancia.company_id == _cid(user))
    if severidad:
        stmt = stmt.where(models.Farmacovigilancia.severidad == severidad)
    if notificado is not None:
        stmt = stmt.where(models.Farmacovigilancia.notificado_dinavisa == notificado)
    stmt = stmt.order_by(desc(models.Farmacovigilancia.fecha_evento)).limit(limit)
    r = await db.execute(stmt)
    return [{
        "id": str(f.id),
        "fecha_evento": f.fecha_evento.isoformat(),
        "sintoma": f.sintoma,
        "severidad": f.severidad,
        "causalidad": f.causalidad,
        "metodo_causalidad": f.metodo_causalidad,
        "desenlace": f.desenlace,
        "requirio_hospitalizacion": f.requirio_hospitalizacion,
        "reportante_nombre": f.reportante_nombre,
        "notificado_dinavisa": f.notificado_dinavisa,
        "numero_recibido_dinavisa": f.numero_recibido_dinavisa,
    } for f in r.scalars().all()]


@router.post("/farmacovigilancia", response_model=schemas.FarmacovigilanciaResponse)
async def create_farmacovigilancia(
    data: schemas.FarmacovigilanciaCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user["id"]) if user.get("id") else None
    return await service.create_farmacovigilancia(db, _cid(user), user_id, data)
