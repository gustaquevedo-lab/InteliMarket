"""Service layer para modulo Servicios Profesionales (sv_*)."""
import asyncio
import hashlib
import hmac
import io
import json
import logging
import secrets
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_, desc, asc, update, delete, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

logger = logging.getLogger(__name__)


# ============================================================
# HELPERS
# ============================================================

def _uuid_str() -> str:
    return str(UUID(int=int.from_bytes(secrets.token_bytes(16), "big", signed=False)))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _next_wo_number(company_id: str, db: AsyncSession) -> str:
    """Genera numero WO incremental: WO-2026-00001."""
    year = datetime.now().year
    return f"WO-{year}-{secrets.token_hex(3).upper()}"


def _customer_name(c) -> str:
    if not c:
        return None
    return getattr(c, "razon_social", None) or getattr(c, "nombre_fantasia", None) or getattr(c, "nombre", None) or "Sin nombre"


def _next_quote_number(company_id: str, db: AsyncSession) -> str:
    year = datetime.now().year
    return f"CT-{year}-{secrets.token_hex(3).upper()}"


def _next_invoice_number(company_id: str, db: AsyncSession) -> str:
    year = datetime.now().year
    return f"INV-{year}-{secrets.token_hex(3).upper()}"


def _next_contract_number(company_id: str, db: AsyncSession) -> str:
    year = datetime.now().year
    return f"CTO-{year}-{secrets.token_hex(3).upper()}"


def _calculate_due_date(fecha_emision: date, plazo_dias: int) -> date:
    return fecha_emision + timedelta(days=plazo_dias)


def _days_until(d: Optional[date]) -> Optional[int]:
    if d is None:
        return None
    return (d - date.today()).days


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia haversine en km."""
    from math import radians, sin, cos, asin, sqrt
    R = 6371.0
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    c = 2 * asin(sqrt(a))
    return R * c


# ============================================================
# VERTICALES / SKILLS
# ============================================================

async def list_verticals(db: AsyncSession) -> List[Dict[str, Any]]:
    from api.src.servicios.models import ServiceVertical
    r = await db.execute(select(ServiceVertical).where(ServiceVertical.activo == True).order_by(ServiceVertical.nombre))
    return [{"id": str(v.id), "codigo": v.codigo, "nombre": v.nombre, "descripcion": v.descripcion, "icono": v.icono, "color": v.color} for v in r.scalars().all()]


async def list_skills(db: AsyncSession, categoria: Optional[str] = None) -> List[Dict[str, Any]]:
    from api.src.servicios.models import Skill
    q = select(Skill).where(Skill.activo == True)
    if categoria:
        q = q.where(Skill.categoria == categoria)
    r = await db.execute(q.order_by(Skill.categoria, Skill.nombre))
    return [{"id": str(s.id), "codigo": s.codigo, "nombre": s.nombre, "categoria": s.categoria, "nivel_maximo": s.nivel_maximo} for s in r.scalars().all()]


async def create_skill(db: AsyncSession, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import Skill
    s = Skill(**data, activo=True)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {"id": str(s.id), "codigo": s.codigo, "nombre": s.nombre, "categoria": s.categoria}


# ============================================================
# TECNICOS
# ============================================================

async def create_technician(db: AsyncSession, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import Technician
    t = Technician(**data, activo=True, disponible=True, rating_promedio=Decimal("5.0"),
                   total_servicios=0, total_clientes=0, primera_visita_pct=Decimal("0"))
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return await _technician_to_dict(t)


async def update_technician(db: AsyncSession, tech_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import Technician
    t = await db.get(Technician, UUID(tech_id))
    if not t:
        return None
    for k, v in data.items():
        if v is not None and hasattr(t, k):
            setattr(t, k, v)
    t.updated_at = _now()
    await db.commit()
    await db.refresh(t)
    return await _technician_to_dict(t)


async def get_technician(db: AsyncSession, tech_id: str) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import Technician
    t = await db.get(Technician, UUID(tech_id))
    if not t:
        return None
    return await _technician_to_dict(t)


async def list_technicians(db: AsyncSession, company_id: str,
                            vertical: Optional[str] = None,
                            active_only: bool = True) -> List[Dict[str, Any]]:
    from api.src.servicios.models import Technician
    q = select(Technician).where(Technician.company_id == UUID(company_id))
    if active_only:
        q = q.where(Technician.activo == True)
    if vertical:
        q = q.where(Technician.vertical_codigo == vertical)
    q = q.order_by(Technician.nombre)
    r = await db.execute(q)
    return [await _technician_to_dict(t) for t in r.scalars().all()]


async def _technician_to_dict(t) -> Dict[str, Any]:
    return {
        "id": str(t.id), "company_id": str(t.company_id), "nombre": t.nombre,
        "vertical_codigo": t.vertical_codigo, "ci": t.ci, "telefono": t.telefono,
        "email": t.email, "foto_url": t.foto_url, "tipo": t.tipo, "modalidad": t.modalidad,
        "fecha_ingreso": t.fecha_ingreso.isoformat() if t.fecha_ingreso else None,
        "tarifa_hora_pyg": t.tarifa_hora_pyg or 0, "tarifa_visita_pyg": t.tarifa_visita_pyg or 0,
        "comision_pct": t.comision_pct or 0, "zonas_cobertura": t.zonas_cobertura or [],
        "biografia": t.biografia, "color_calendario": t.color_calendario,
        "rating_promedio": float(t.rating_promedio or 0),
        "total_servicios": t.total_servicios or 0, "total_clientes": t.total_clientes or 0,
        "primera_visita_pct": float(t.primera_visita_pct or 0),
        "es_lider_equipo": t.es_lider_equipo, "activo": t.activo, "disponible": t.disponible,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


async def add_skill_to_technician(db: AsyncSession, company_id: str, tech_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import TechnicianSkill, Skill
    ts = TechnicianSkill(company_id=UUID(company_id), technician_id=UUID(tech_id), **data)
    db.add(ts)
    await db.commit()
    sk = await db.get(Skill, UUID(data["skill_id"]))
    return {
        "id": str(ts.id), "technician_id": str(ts.technician_id), "skill_id": str(ts.skill_id),
        "nivel": ts.nivel, "certificado": ts.certificado,
        "skill_nombre": sk.nombre if sk else None, "skill_codigo": sk.codigo if sk else None,
    }


async def list_technician_skills(db: AsyncSession, tech_id: str) -> List[Dict[str, Any]]:
    from api.src.servicios.models import TechnicianSkill, Skill
    q = select(TechnicianSkill, Skill).join(Skill, TechnicianSkill.skill_id == Skill.id).where(TechnicianSkill.technician_id == UUID(tech_id))
    r = await db.execute(q)
    out = []
    for ts, sk in r.all():
        out.append({
            "id": str(ts.id), "technician_id": str(ts.technician_id), "skill_id": str(ts.skill_id),
            "nivel": ts.nivel, "certificado": ts.certificado, "fecha_adquisicion": ts.fecha_adquisicion,
            "skill_nombre": sk.nombre, "skill_codigo": sk.codigo, "skill_categoria": sk.categoria,
        })
    return out


async def add_certification(db: AsyncSession, company_id: str, tech_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import TechnicianCertification
    dias = _days_until(data.get("fecha_vencimiento"))
    cert = TechnicianCertification(company_id=UUID(company_id), technician_id=UUID(tech_id), dias_para_vencer=dias, alerta_enviada=False, **data)
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return {"id": str(cert.id), "technician_id": str(cert.technician_id), "tipo": cert.tipo, "nombre": cert.nombre,
            "fecha_vencimiento": cert.fecha_vencimiento, "dias_para_vencer": cert.dias_para_vencer, "alerta_enviada": cert.alerta_enviada}


async def list_certifications(db: AsyncSession, tech_id: Optional[str] = None, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
    from api.src.servicios.models import TechnicianCertification
    q = select(TechnicianCertification)
    if tech_id:
        q = q.where(TechnicianCertification.technician_id == UUID(tech_id))
    if company_id:
        q = q.where(TechnicianCertification.company_id == UUID(company_id))
    q = q.order_by(TechnicianCertification.fecha_vencimiento.asc().nullslast())
    r = await db.execute(q)
    out = []
    for c in r.scalars().all():
        out.append({
            "id": str(c.id), "company_id": str(c.company_id), "technician_id": str(c.technician_id),
            "tipo": c.tipo, "nombre": c.nombre, "institucion": c.institucion, "numero": c.numero,
            "fecha_emision": c.fecha_emision, "fecha_vencimiento": c.fecha_vencimiento,
            "dias_para_vencer": c.dias_para_vencer, "alerta_enviada": c.alerta_enviada,
            "alerta_dias": c.alerta_dias, "archivo_url": c.archivo_url, "notas": c.notas,
        })
    return out


async def check_expiring_certifications(db: AsyncSession, company_id: str) -> List[Dict[str, Any]]:
    """Detecta certificaciones que vencen en los proximos 30 dias."""
    from api.src.servicios.models import TechnicianCertification
    threshold = date.today() + timedelta(days=30)
    q = select(TechnicianCertification).where(
        and_(TechnicianCertification.company_id == UUID(company_id),
             TechnicianCertification.fecha_vencimiento <= threshold,
             TechnicianCertification.alerta_enviada == False)
    )
    r = await db.execute(q)
    return [{"id": str(c.id), "technician_id": str(c.technician_id), "nombre": c.nombre,
             "dias_para_vencer": c.dias_para_vencer, "fecha_vencimiento": c.fecha_vencimiento.isoformat() if c.fecha_vencimiento else None} for c in r.scalars().all()]


# ============================================================
# PROPIEDADES / EQUIPOS
# ============================================================

async def create_property(db: AsyncSession, company_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import Property
    p = Property(company_id=UUID(company_id), **data, activo=True)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {"id": str(p.id), "company_id": str(p.company_id), "customer_id": str(p.customer_id),
            "nombre": p.nombre, "tipo": p.tipo, "direccion": p.direccion, "ciudad": p.ciudad, "activo": p.activo}


async def list_properties(db: AsyncSession, company_id: str, customer_id: Optional[str] = None) -> List[Dict[str, Any]]:
    from api.src.servicios.models import Property, Equipment
    q = select(Property).where(and_(Property.company_id == UUID(company_id), Property.activo == True))
    if customer_id:
        q = q.where(Property.customer_id == UUID(customer_id))
    q = q.order_by(Property.nombre)
    r = await db.execute(q)
    out = []
    for p in r.scalars().all():
        # count equipment
        ec = await db.execute(select(func.count(Equipment.id)).where(and_(Equipment.property_id == p.id, Equipment.activo == True)))
        count = ec.scalar() or 0
        out.append({
            "id": str(p.id), "company_id": str(p.company_id), "customer_id": str(p.customer_id),
            "nombre": p.nombre, "tipo": p.tipo, "direccion": p.direccion, "ciudad": p.ciudad,
            "departamento": p.departamento, "lat": p.lat, "lng": p.lng, "zona_id": str(p.zona_id) if p.zona_id else None,
            "metros_cuadrados": p.metros_cuadrados, "pisos": p.pisos, "habitaciones": p.habitaciones,
            "banos": p.banos, "contacto_nombre": p.contacto_nombre, "contacto_telefono": p.contacto_telefono,
            "activo": p.activo, "equipment_count": count,
        })
    return out


async def create_equipment(db: AsyncSession, company_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import Equipment, Property
    prop = await db.get(Property, UUID(data["property_id"]))
    if not prop:
        return None
    eq = Equipment(company_id=UUID(company_id), customer_id=prop.customer_id, **data, activo=True)
    db.add(eq)
    await db.commit()
    await db.refresh(eq)
    return {"id": str(eq.id), "company_id": str(eq.company_id), "property_id": str(eq.property_id),
            "customer_id": str(eq.customer_id), "tipo": eq.tipo, "marca": eq.marca, "modelo": eq.modelo,
            "numero_serie": eq.numero_serie, "estado": eq.estado, "proximo_mantenimiento": eq.proximo_mantenimiento}


async def list_equipment(db: AsyncSession, company_id: str, property_id: Optional[str] = None) -> List[Dict[str, Any]]:
    from api.src.servicios.models import Equipment
    q = select(Equipment).where(and_(Equipment.company_id == UUID(company_id), Equipment.activo == True))
    if property_id:
        q = q.where(Equipment.property_id == UUID(property_id))
    q = q.order_by(Equipment.tipo, Equipment.marca)
    r = await db.execute(q)
    return [{
        "id": str(e.id), "company_id": str(e.company_id), "property_id": str(e.property_id),
        "customer_id": str(e.customer_id), "tipo": e.tipo, "marca": e.marca, "modelo": e.modelo,
        "numero_serie": e.numero_serie, "capacidad": e.capacidad, "ubicacion": e.ubicacion,
        "fecha_instalacion": e.fecha_instalacion, "fecha_garantia_fin": e.fecha_garantia_fin,
        "ultimo_mantenimiento": e.ultimo_mantenimiento, "proximo_mantenimiento": e.proximo_mantenimiento,
        "estado": e.estado, "frecuencia_mantenimiento_dias": e.frecuencia_mantenimiento_dias,
        "activo": e.activo,
    } for e in r.scalars().all()]


# ============================================================
# COTIZACIONES
# ============================================================

async def create_quote(db: AsyncSession, company_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import ServiceQuote, ServiceQuoteItem
    items_data = data.pop("items", [])
    numero = _next_quote_number(company_id, db)
    fecha_cot = date.today()
    fecha_val = fecha_cot + timedelta(days=data.get("tiempo_validez_dias", 15))
    subt_mano_obra = Decimal("0"); subt_mat = Decimal("0"); subt_eq = Decimal("0"); subt_sub = Decimal("0")
    items_to_create = []
    for it in items_data:
        qty = Decimal(str(it.get("cantidad", 1)))
        pu = Decimal(str(it.get("precio_unitario", 0)))
        disc = Decimal(str(it.get("descuento_pct", 0)))
        sub = qty * pu * (1 - disc / 100)
        tipo = it.get("tipo", "mano_obra")
        if tipo == "mano_obra": subt_mano_obra += sub
        elif tipo == "material": subt_mat += sub
        elif tipo == "equipo": subt_eq += sub
        elif tipo == "subcontrato": subt_sub += sub
        items_to_create.append({**it, "subtotal": sub})
    subtotal = subt_mano_obra + subt_mat + subt_eq + subt_sub
    desc_pct = Decimal(str(data.get("descuento_pct", 0)))
    desc_monto = subtotal * desc_pct / 100
    base_iva = subtotal - desc_monto
    iva_pct = Decimal(str(data.get("iva_pct", 10)))
    iva_monto = base_iva * iva_pct / 100
    total = base_iva + iva_monto
    q = ServiceQuote(
        company_id=UUID(company_id), numero=numero, estado="borrador",
        fecha_cotizacion=fecha_cot, fecha_validez=fecha_val,
        subtmano_obra=subt_mano_obra, subtotal_materiales=subt_mat,
        subtotal_equipos=subt_eq, subtotal_subcontratos=subt_sub,
        descuento_pct=desc_pct, descuento_monto=desc_monto, iva_pct=iva_pct,
        iva_monto=iva_monto, total=total,
        **{k: v for k, v in data.items() if k not in (
            'descuento_pct', 'descuento_monto', 'iva_pct', 'iva_monto', 'total',
            'subtmano_obra', 'subtotal_materiales', 'subtotal_equipos', 'subtotal_subcontratos',
            'items', 'company_id', 'numero', 'estado',
        )},
    )
    db.add(q)
    await db.flush()
    for it in items_to_create:
        qi = ServiceQuoteItem(company_id=UUID(company_id), quote_id=q.id, **it)
        db.add(qi)
    await db.commit()
    await db.refresh(q)
    return await get_quote(db, str(q.id))


async def get_quote(db: AsyncSession, quote_id: str) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import ServiceQuote, ServiceQuoteItem
    from api.src.customers.models import Customer
    try:
        qid = UUID(quote_id)
    except ValueError:
        return None
    q = await db.get(ServiceQuote, qid, options=[selectinload(ServiceQuote.items_relation)])
    if not q:
        return None
    cust = await db.get(Customer, q.customer_id) if q.customer_id else None
    tech_name = None
    if q.technician_id:
        from api.src.servicios.models import Technician
        t = await db.get(Technician, q.technician_id)
        if t: tech_name = t.nombre
    items = [{
        "id": str(i.id), "tipo": i.tipo, "codigo": i.codigo, "descripcion": i.descripcion,
        "cantidad": float(i.cantidad or 0), "unidad": i.unidad, "precio_unitario": float(i.precio_unitario or 0),
        "descuento_pct": float(i.descuento_pct or 0), "subtotal": float(i.subtotal or 0),
        "iva_incluido": i.iva_incluido, "orden": i.orden,
    } for i in q.items_relation]
    return {
        "id": str(q.id), "company_id": str(q.company_id), "numero": q.numero,
        "customer_id": str(q.customer_id), "customer_nombre": _customer_name(cust),
        "property_id": str(q.property_id) if q.property_id else None,
        "equipment_id": str(q.equipment_id) if q.equipment_id else None,
        "technician_id": str(q.technician_id) if q.technician_id else None,
        "technician_nombre": tech_name, "vertical_codigo": q.vertical_codigo,
        "titulo": q.titulo, "descripcion": q.descripcion, "estado": q.estado,
        "fecha_cotizacion": q.fecha_cotizacion, "fecha_validez": q.fecha_validez,
        "duracion_estimada_horas": float(q.duracion_estimada_horas or 0),
        "subtmano_obra": float(q.subtmano_obra or 0),
        "subtotal_materiales": float(q.subtotal_materiales or 0),
        "subtotal_equipos": float(q.subtotal_equipos or 0),
        "subtotal_subcontratos": float(q.subtotal_subcontratos or 0),
        "descuento_pct": float(q.descuento_pct or 0), "descuento_monto": float(q.descuento_monto or 0),
        "iva_pct": float(q.iva_pct or 0), "iva_monto": float(q.iva_monto or 0),
        "total": float(q.total or 0), "pdf_url": q.pdf_url,
        "condiciones": q.condiciones, "metodo_pago_propuesto": q.metodo_pago_propuesto,
        "items": items, "created_at": q.created_at,
    }


async def list_quotes(db: AsyncSession, company_id: str, estado: Optional[str] = None,
                      customer_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    from api.src.servicios.models import ServiceQuote
    from api.src.customers.models import Customer
    q = select(ServiceQuote).where(ServiceQuote.company_id == UUID(company_id))
    if estado: q = q.where(ServiceQuote.estado == estado)
    if customer_id: q = q.where(ServiceQuote.customer_id == UUID(customer_id))
    q = q.order_by(desc(ServiceQuote.created_at)).limit(limit)
    r = await db.execute(q)
    out = []
    for qq in r.scalars().all():
        cust = await db.get(Customer, qq.customer_id) if qq.customer_id else None
        out.append({
            "id": str(qq.id), "numero": qq.numero, "titulo": qq.titulo,
            "customer_id": str(qq.customer_id), "customer_nombre": _customer_name(cust),
            "estado": qq.estado, "fecha_cotizacion": qq.fecha_cotizacion,
            "fecha_validez": qq.fecha_validez, "total": float(qq.total or 0),
            "created_at": qq.created_at,
        })
    return out


async def update_quote(db: AsyncSession, quote_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import ServiceQuote, ServiceQuoteItem
    q = await db.get(ServiceQuote, UUID(quote_id))
    if not q:
        return None
    items_data = data.pop("items", None)
    for k, v in data.items():
        if v is not None and hasattr(q, k):
            setattr(q, k, v)
    if items_data is not None:
        # delete existing
        await db.execute(delete(ServiceQuoteItem).where(ServiceQuoteItem.quote_id == q.id))
        subt_mano_obra = Decimal("0"); subt_mat = Decimal("0"); subt_eq = Decimal("0"); subt_sub = Decimal("0")
        for it in items_data:
            qty = Decimal(str(it.get("cantidad", 1))); pu = Decimal(str(it.get("precio_unitario", 0)))
            disc = Decimal(str(it.get("descuento_pct", 0)))
            sub = qty * pu * (1 - disc / 100)
            tipo = it.get("tipo", "mano_obra")
            if tipo == "mano_obra": subt_mano_obra += sub
            elif tipo == "material": subt_mat += sub
            elif tipo == "equipo": subt_eq += sub
            elif tipo == "subcontrato": subt_sub += sub
            qi = ServiceQuoteItem(company_id=q.company_id, quote_id=q.id, subtotal=sub, **it)
            db.add(qi)
        subtotal = subt_mano_obra + subt_mat + subt_eq + subt_sub
        desc_pct = Decimal(str(q.descuento_pct or 0))
        desc_monto = subtotal * desc_pct / 100
        base_iva = subtotal - desc_monto
        iva_pct = Decimal(str(q.iva_pct or 10))
        iva_monto = base_iva * iva_pct / 100
        q.subtmano_obra = subt_mano_obra
        q.subtotal_materiales = subt_mat
        q.subtotal_equipos = subt_eq
        q.subtotal_subcontratos = subt_sub
        q.descuento_monto = desc_monto
        q.iva_monto = iva_monto
        q.total = base_iva + iva_monto
    q.updated_at = _now()
    await db.commit()
    return await get_quote(db, quote_id)


async def convert_quote_to_work_order(db: AsyncSession, quote_id: str, fecha_programada: date,
                                       technician_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import ServiceQuote, ServiceQuoteItem, WorkOrder, WorkOrderItem, Appointment
    q = await db.get(ServiceQuote, UUID(quote_id), options=[selectinload(ServiceQuote.items_relation)])
    if not q:
        return None
    if q.estado == "convertida_wo":
        return None
    tech_id = technician_id or str(q.technician_id) if q.technician_id else None
    if not tech_id:
        return None
    numero = _next_wo_number(str(q.company_id), db)
    wo = WorkOrder(
        company_id=q.company_id, numero=numero, customer_id=q.customer_id,
        property_id=q.property_id, equipment_id=q.equipment_id,
        technician_id=UUID(tech_id), quote_id=q.id, vertical_codigo=q.vertical_codigo,
        tipo="servicio", estado="agendada", prioridad="normal",
        titulo=q.titulo, descripcion_cliente=q.descripcion,
        fecha_programada=fecha_programada, duracion_estimada_horas=q.duracion_estimada_horas,
        subtmano_obra=q.subtmano_obra, subtotal_materiales=q.subtotal_materiales,
        descuento=q.descuento_monto, iva=q.iva_monto, total=q.total,
    )
    db.add(wo)
    await db.flush()
    for qi in q.items_relation:
        woi = WorkOrderItem(
            company_id=q.company_id, work_order_id=wo.id, tipo=qi.tipo, codigo=qi.codigo,
            descripcion=qi.descripcion, detalle=qi.detalle, cantidad=qi.cantidad, unidad=qi.unidad,
            precio_unitario=qi.precio_unitario, descuento_pct=qi.descuento_pct,
            subtotal=qi.subtotal, iva_incluido=qi.iva_incluido, orden=qi.orden,
        )
        db.add(woi)
    # also create an appointment
    ap = Appointment(
        company_id=q.company_id, customer_id=q.customer_id, property_id=q.property_id,
        technician_id=UUID(tech_id), quote_id=q.id, tipo="servicio", estado="agendada",
        titulo=q.titulo, descripcion=q.descripcion, fecha=fecha_programada,
        hora_desde=time(9, 0), hora_hasta=time(10, 0), duracion_estimada_minutos=60,
    )
    db.add(ap)
    q.estado = "convertida_wo"
    await db.commit()
    await db.refresh(wo)
    return {"work_order_id": str(wo.id), "appointment_id": str(ap.id), "numero": numero}


# ============================================================
# AGENDA / APPOINTMENTS
# ============================================================

async def create_appointment(db: AsyncSession, company_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import Appointment
    a = Appointment(company_id=UUID(company_id), estado="agendada", recordatorio_enviado=False,
                    confirmada=False, **data)
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return await get_appointment(db, str(a.id))


async def get_appointment(db: AsyncSession, ap_id: str) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import Appointment, Technician, Property
    from api.src.customers.models import Customer
    try:
        aid = UUID(ap_id)
    except ValueError:
        return None
    a = await db.get(Appointment, aid)
    if not a:
        return None
    cust = await db.get(Customer, a.customer_id) if a.customer_id else None
    tech = await db.get(Technician, a.technician_id) if a.technician_id else None
    prop = await db.get(Property, a.property_id) if a.property_id else None
    return {
        "id": str(a.id), "company_id": str(a.company_id),
        "customer_id": str(a.customer_id), "customer_nombre": _customer_name(cust),
        "customer_telefono": cust.telefono if cust else None,
        "property_id": str(a.property_id) if a.property_id else None,
        "property_direccion": prop.direccion if prop else None,
        "technician_id": str(a.technician_id), "technician_nombre": tech.nombre if tech else None,
        "technician_color": tech.color_calendario if tech else "#3b82f6",
        "quote_id": str(a.quote_id) if a.quote_id else None,
        "tipo": a.tipo, "estado": a.estado, "prioridad": a.prioridad,
        "titulo": a.titulo, "descripcion": a.descripcion,
        "fecha": a.fecha, "hora_desde": a.hora_desde, "hora_hasta": a.hora_hasta,
        "duracion_estimada_minutos": a.duracion_estimada_minutos,
        "ventana_tiempo": a.ventana_tiempo, "direccion": a.direccion,
        "lat": a.lat, "lng": a.lng,
        "recordatorio_enviado": a.recordatorio_enviado,
        "confirmada": a.confirmada, "color": a.color,
        "created_at": a.created_at,
    }


async def list_appointments(db: AsyncSession, company_id: str,
                              fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None,
                              technician_id: Optional[str] = None,
                              estado: Optional[str] = None) -> List[Dict[str, Any]]:
    from api.src.servicios.models import Appointment
    q = select(Appointment).where(Appointment.company_id == UUID(company_id))
    if fecha_desde: q = q.where(Appointment.fecha >= fecha_desde)
    if fecha_hasta: q = q.where(Appointment.fecha <= fecha_hasta)
    if technician_id: q = q.where(Appointment.technician_id == UUID(technician_id))
    if estado: q = q.where(Appointment.estado == estado)
    q = q.order_by(Appointment.fecha, Appointment.hora_desde).limit(500)
    r = await db.execute(q)
    out = []
    for a in r.scalars().all():
        out.append(await get_appointment(db, str(a.id)))
    return [x for x in out if x]


async def update_appointment(db: AsyncSession, ap_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import Appointment
    a = await db.get(Appointment, UUID(ap_id))
    if not a:
        return None
    for k, v in data.items():
        if v is not None and hasattr(a, k):
            setattr(a, k, v)
    a.updated_at = _now()
    await db.commit()
    return await get_appointment(db, ap_id)


async def ai_dispatch(db: AsyncSession, company_id: str, lat: float, lng: float,
                      fecha: date, hora_desde: time, duracion_min: int = 60,
                      required_skill_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Encuentra los mejores tecnicos disponibles: por cercania + skills + disponibilidad."""
    from api.src.servicios.models import Technician, TechnicianSkill, Appointment
    # 1. candidatos: tecnicos activos y disponibles
    q = select(Technician).where(and_(Technician.company_id == UUID(company_id), Technician.activo == True, Technician.disponible == True))
    if required_skill_id:
        q = q.join(TechnicianSkill, TechnicianSkill.technician_id == Technician.id).where(TechnicianSkill.skill_id == UUID(required_skill_id))
    r = await db.execute(q)
    candidates = r.scalars().all()
    # 2. calcular score
    results = []
    for t in candidates:
        # distancia
        if t.lat_base is not None and t.lng_base is not None:
            dist = _haversine_km(float(t.lat), float(t.lng), float(t.lat_base), float(t.lng_base))
        else:
            dist = 999  # sin coordenadas, prioridad baja
        # conflictos: citas agendadas en la misma fecha+hora
        conflict_q = select(func.count(Appointment.id)).where(and_(
            Appointment.technician_id == t.id, Appointment.fecha == fecha,
            Appointment.estado.in_(["agendada", "confirmada", "en_camino", "en_sitio"]),
        ))
        cr = await db.execute(conflict_q)
        conflicts = cr.scalar() or 0
        # rating
        rating = float(t.rating_promedio or 5.0)
        # score: menor distancia, menos conflictos, mayor rating
        score = 100 - dist * 0.5 - conflicts * 20 + rating * 5
        results.append({
            "technician_id": str(t.id), "nombre": t.nombre, "score": round(score, 2),
            "distancia_km": round(dist, 2), "conflictos": conflicts, "rating": rating,
            "color": t.color_calendario, "tarifa_hora_pyg": float(t.tarifa_hora_pyg or 0),
        })
    results.sort(key=lambda x: x["score"], reverse=True)
    return results


# ============================================================
# WORK ORDERS
# ============================================================

async def create_work_order(db: AsyncSession, company_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import WorkOrder, WorkOrderItem
    items_data = data.pop("items", [])
    numero = _next_wo_number(company_id, db)
    subt_mano_obra = Decimal("0"); subt_mat = Decimal("0")
    items_to_create = []
    for it in items_data:
        qty = Decimal(str(it.get("cantidad", 1))); pu = Decimal(str(it.get("precio_unitario", 0)))
        disc = Decimal(str(it.get("descuento_pct", 0)))
        sub = qty * pu * (1 - disc / 100)
        tipo = it.get("tipo", "mano_obra")
        if tipo == "mano_obra": subt_mano_obra += sub
        elif tipo == "material": subt_mat += sub
        items_to_create.append({**it, "subtotal": sub})
    subtotal = subt_mano_obra + subt_mat
    iva = subtotal * Decimal("0.10")
    total = subtotal + iva
    wo = WorkOrder(
        company_id=UUID(company_id), numero=numero, estado="agendada", prioridad=data.get("prioridad", "normal"),
        subtmano_obra=subt_mano_obra, subtotal_materiales=subt_mat, descuento=Decimal("0"),
        iva=iva, total=total,
        **{k: v for k, v in data.items() if k not in (
            'subtmano_obra', 'subtotal_materiales', 'subtotal_equipos', 'subtmano_obra',
            'descuento', 'iva', 'total', 'items', 'company_id', 'numero', 'estado', 'prioridad',
        )},
    )
    db.add(wo)
    await db.flush()
    for it in items_to_create:
        woi = WorkOrderItem(company_id=UUID(company_id), work_order_id=wo.id, **it)
        db.add(woi)
    await db.commit()
    await db.refresh(wo)
    return await get_work_order(db, str(wo.id))


async def get_work_order(db: AsyncSession, wo_id: str) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import WorkOrder, WorkOrderItem, Technician
    from api.src.customers.models import Customer
    try:
        wid = UUID(wo_id)
    except ValueError:
        return None
    wo = await db.get(WorkOrder, wid, options=[selectinload(WorkOrder.items_relation)])
    if not wo:
        return None
    cust = await db.get(Customer, wo.customer_id) if wo.customer_id else None
    tech = await db.get(Technician, wo.technician_id) if wo.technician_id else None
    items = [{
        "id": str(i.id), "tipo": i.tipo, "codigo": i.codigo, "descripcion": i.descripcion,
        "cantidad": float(i.cantidad or 0), "unidad": i.unidad, "precio_unitario": float(i.precio_unitario or 0),
        "descuento_pct": float(i.descuento_pct or 0), "subtotal": float(i.subtotal or 0),
        "iva_incluido": i.iva_incluido, "orden": i.orden, "product_id": str(i.product_id) if i.product_id else None,
        "tecnico_id": str(i.tecnico_id) if i.tecnico_id else None, "horas": float(i.horas or 0),
    } for i in wo.items_relation]
    return {
        "id": str(wo.id), "company_id": str(wo.company_id), "numero": wo.numero,
            "customer_id": str(wo.customer_id), "customer_nombre": _customer_name(cust),
        "property_id": str(wo.property_id) if wo.property_id else None,
        "equipment_id": str(wo.equipment_id) if wo.equipment_id else None,
        "technician_id": str(wo.technician_id), "technician_nombre": tech.nombre if tech else None,
        "quote_id": str(wo.quote_id) if wo.quote_id else None,
        "appointment_id": str(wo.appointment_id) if wo.appointment_id else None,
        "vertical_codigo": wo.vertical_codigo, "tipo": wo.tipo, "estado": wo.estado,
        "prioridad": wo.prioridad, "titulo": wo.titulo, "descripcion_cliente": wo.descripcion_cliente,
        "problema_reportado": wo.problema_reportado, "diagnostico": wo.diagnostico,
        "solucion_aplicada": wo.solucion_aplicada, "recomendaciones": wo.recomendaciones,
        "fecha_programada": wo.fecha_programada, "hora_programada": wo.hora_programada,
        "fecha_checkin": wo.fecha_checkin, "lat_checkin": wo.lat_checkin, "lng_checkin": wo.lng_checkin,
        "fecha_inicio": wo.fecha_inicio, "fecha_fin": wo.fecha_fin,
        "duracion_real_minutos": wo.duracion_real_minutos,
        "duracion_estimada_horas": float(wo.duracion_estimada_horas or 0),
        "subtmano_obra": float(wo.subtmano_obra or 0),
        "subtotal_materiales": float(wo.subtotal_materiales or 0),
        "descuento": float(wo.descuento or 0), "iva": float(wo.iva or 0),
        "total": float(wo.total or 0), "invoice_id": str(wo.invoice_id) if wo.invoice_id else None,
        "requiere_garantia": wo.requiere_garantia, "dias_garantia": wo.dias_garantia,
        "satisfaccion_nps": wo.satisfaccion_nps, "nombre_firmante": wo.nombre_firmante,
        "ci_firmante": wo.ci_firmante, "items": items, "created_at": wo.created_at,
    }


async def list_work_orders(db: AsyncSession, company_id: str,
                            estado: Optional[str] = None, technician_id: Optional[str] = None,
                            customer_id: Optional[str] = None,
                            fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None,
                            limit: int = 100) -> List[Dict[str, Any]]:
    from api.src.servicios.models import WorkOrder, Technician
    from api.src.customers.models import Customer
    q = select(WorkOrder).where(WorkOrder.company_id == UUID(company_id))
    if estado: q = q.where(WorkOrder.estado == estado)
    if technician_id: q = q.where(WorkOrder.technician_id == UUID(technician_id))
    if customer_id: q = q.where(WorkOrder.customer_id == UUID(customer_id))
    if fecha_desde: q = q.where(WorkOrder.fecha_programada >= fecha_desde)
    if fecha_hasta: q = q.where(WorkOrder.fecha_programada <= fecha_hasta)
    q = q.order_by(desc(WorkOrder.fecha_programada)).limit(limit)
    r = await db.execute(q)
    out = []
    for wo in r.scalars().all():
        cust = await db.get(Customer, wo.customer_id) if wo.customer_id else None
        tech = await db.get(Technician, wo.technician_id) if wo.technician_id else None
        out.append({
            "id": str(wo.id), "numero": wo.numero,
        "customer_id": str(wo.customer_id), "customer_nombre": _customer_name(cust),
            "technician_id": str(wo.technician_id), "technician_nombre": tech.nombre if tech else None,
            "estado": wo.estado, "prioridad": wo.prioridad, "titulo": wo.titulo,
            "fecha_programada": wo.fecha_programada, "total": float(wo.total or 0),
            "vertical_codigo": wo.vertical_codigo, "created_at": wo.created_at,
        })
    return out


async def update_work_order(db: AsyncSession, wo_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import WorkOrder
    wo = await db.get(WorkOrder, UUID(wo_id))
    if not wo:
        return None
    # cuando se marca como completada, auto-crear invoice si requiere_factura
    prev_estado = wo.estado
    for k, v in data.items():
        if v is not None and hasattr(wo, k):
            setattr(wo, k, v)
    wo.updated_at = _now()
    if prev_estado != "completada" and wo.estado == "completada" and wo.requiere_factura and not wo.invoice_id:
        # auto-generar invoice
        inv = await _auto_invoice_from_wo(db, wo)
        if inv:
            wo.invoice_id = inv["id"]
    await db.commit()
    return await get_work_order(db, wo_id)


async def _auto_invoice_from_wo(db: AsyncSession, wo) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import ServiceInvoice
    numero = _next_invoice_number(str(wo.company_id), db)
    fecha_venc = _calculate_due_date(date.today(), 30)
    total = Decimal(str(wo.total or 0))
    inv = ServiceInvoice(
        company_id=wo.company_id, numero=numero, customer_id=wo.customer_id,
        work_order_id=wo.id, estado="emitida", fecha_emision=date.today(),
        fecha_vencimiento=fecha_venc, plazo_pago_dias=30,
        subtotal=total - Decimal(str(wo.iva or 0)), descuento=Decimal(str(wo.descuento or 0)),
        iva=Decimal(str(wo.iva or 0)), total=total, monto_pagado=Decimal("0"),
        saldo=total, dias_mora=0, requiere_sifen=True,
    )
    db.add(inv)
    await db.flush()
    return {"id": str(inv.id)}


# ============================================================
# CONTRATOS
# ============================================================

async def create_contract(db: AsyncSession, company_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import ServiceContract
    numero = _next_contract_number(company_id, db)
    visitas_anio = data.get("visitas_incluidas_anio", 12)
    visitas_restantes = visitas_anio - data.get("visitas_realizadas", 0)
    c = ServiceContract(
        company_id=UUID(company_id), numero=numero, estado="activo",
        visitas_incluidas_anio=visitas_anio, visitas_restantes=visitas_restantes,
        visitas_realizadas=data.get("visitas_realizadas", 0),
        fecha_proximo_cobro=data.get("fecha_inicio"), **data,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return await get_contract(db, str(c.id))


async def get_contract(db: AsyncSession, contract_id: str) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import ServiceContract
    from api.src.customers.models import Customer
    try:
        cid = UUID(contract_id)
    except ValueError:
        return None
    c = await db.get(ServiceContract, cid)
    if not c:
        return None
    cust = await db.get(Customer, c.customer_id) if c.customer_id else None
    return {
        "id": str(c.id), "company_id": str(c.company_id), "numero": c.numero,
            "customer_id": str(c.customer_id), "customer_nombre": _customer_name(cust),
        "titulo": c.titulo, "descripcion": c.descripcion, "estado": c.estado,
        "fecha_inicio": c.fecha_inicio, "fecha_fin": c.fecha_fin,
        "duracion_meses": c.duracion_meses, "renovacion_auto": c.renovacion_auto,
        "frecuencia_visitas": c.frecuencia_visitas,
        "visitas_incluidas_anio": c.visitas_incluidas_anio,
        "visitas_realizadas": c.visitas_realizadas,
        "visitas_restantes": c.visitas_restantes,
        "monto_mensual_pyg": float(c.monto_mensual_pyg or 0),
        "incluye_emergencias": c.incluye_emergencias,
        "tiempo_respuesta_horas": c.tiempo_respuesta_horas,
        "tiempo_resolucion_horas": c.tiempo_resolucion_horas,
        "sla_texto": c.sla_texto, "fecha_proximo_cobro": c.fecha_proximo_cobro,
        "created_at": c.created_at,
    }


async def list_contracts(db: AsyncSession, company_id: str, estado: Optional[str] = None) -> List[Dict[str, Any]]:
    from api.src.servicios.models import ServiceContract
    from api.src.customers.models import Customer
    q = select(ServiceContract).where(ServiceContract.company_id == UUID(company_id))
    if estado: q = q.where(ServiceContract.estado == estado)
    q = q.order_by(desc(ServiceContract.created_at))
    r = await db.execute(q)
    out = []
    for c in r.scalars().all():
        cust = await db.get(Customer, c.customer_id) if c.customer_id else None
        out.append({
            "id": str(c.id), "numero": c.numero, "titulo": c.titulo,
        "customer_id": str(c.customer_id), "customer_nombre": _customer_name(cust),
            "estado": c.estado, "fecha_inicio": c.fecha_inicio, "fecha_fin": c.fecha_fin,
            "frecuencia_visitas": c.frecuencia_visitas,
            "monto_mensual_pyg": float(c.monto_mensual_pyg or 0),
            "visitas_incluidas_anio": c.visitas_incluidas_anio,
            "visitas_realizadas": c.visitas_realizadas,
        })
    return out


async def generate_contract_visits(db: AsyncSession, contract_id: str) -> int:
    """Genera visitas segun la frecuencia del contrato (mensual, trimestral, etc)."""
    from api.src.servicios.models import ServiceContract, ContractVisit
    c = await db.get(ServiceContract, UUID(contract_id))
    if not c:
        return 0
    freq_days = {"mensual": 30, "bimestral": 60, "trimestral": 90, "semestral": 180, "anual": 365}
    interval = freq_days.get(c.frecuencia_visitas, 30)
    # contar visitas existentes
    qc = select(func.count(ContractVisit.id)).where(ContractVisit.contract_id == c.id)
    rc = await db.execute(qc)
    existing = rc.scalar() or 0
    target = c.visitas_incluidas_anio
    if existing >= target:
        return 0
    created = 0
    fecha = c.fecha_inicio
    for i in range(existing, target):
        fecha = c.fecha_inicio + timedelta(days=interval * i)
        cv = ContractVisit(
            company_id=c.company_id, contract_id=c.id, numero_visita=i + 1,
            fecha_programada=fecha, estado="programada", tipo="mantenimiento", completado_pct=Decimal("0"),
        )
        db.add(cv)
        created += 1
    await db.commit()
    return created


async def list_contract_visits(db: AsyncSession, contract_id: str) -> List[Dict[str, Any]]:
    from api.src.servicios.models import ContractVisit
    q = select(ContractVisit).where(ContractVisit.contract_id == UUID(contract_id)).order_by(ContractVisit.numero_visita)
    r = await db.execute(q)
    return [{
        "id": str(v.id), "contract_id": str(v.contract_id), "numero_visita": v.numero_visita,
        "fecha_programada": v.fecha_programada, "fecha_realizada": v.fecha_realizada,
        "work_order_id": str(v.work_order_id) if v.work_order_id else None,
        "technician_id": str(v.technician_id) if v.technician_id else None,
        "estado": v.estado, "tipo": v.tipo, "completado_pct": float(v.completado_pct or 0),
        "notas": v.notas,
    } for v in r.scalars().all()]


# ============================================================
# INVENTARIO MOVIL
# ============================================================

async def list_truck_inventory(db: AsyncSession, company_id: str, technician_id: Optional[str] = None) -> List[Dict[str, Any]]:
    from api.src.servicios.models import TruckInventory, Technician
    q = select(TruckInventory, Technician).join(Technician, TruckInventory.technician_id == Technician.id).where(TruckInventory.company_id == UUID(company_id))
    if technician_id:
        q = q.where(TruckInventory.technician_id == UUID(technician_id))
    r = await db.execute(q)
    out = []
    for inv, tech in r.all():
        out.append({
            "id": str(inv.id), "technician_id": str(inv.technician_id), "technician_nombre": tech.nombre,
            "product_id": str(inv.product_id), "codigo": inv.codigo, "descripcion": inv.descripcion,
            "cantidad_actual": float(inv.cantidad_actual or 0), "cantidad_minima": float(inv.cantidad_minima or 0),
            "cantidad_maxima": float(inv.cantidad_maxima or 0) if inv.cantidad_maxima else None,
            "ubicacion_vehiculo": inv.ubicacion_vehiculo, "necesita_reposicion": inv.necesita_reposicion,
        })
    return out


async def register_inventory_movement(db: AsyncSession, company_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import ServiceInventoryMovement, TruckInventory
    tech_id = data.get("technician_id")
    if not tech_id:
        return None
    # encontrar stock actual
    inv = await db.execute(select(TruckInventory).where(and_(
        TruckInventory.technician_id == UUID(tech_id),
        TruckInventory.product_id == UUID(data["product_id"]),
    )))
    inv_obj = inv.scalar_one_or_none()
    if not inv_obj:
        return None
    prev = inv_obj.cantidad_actual
    delta = Decimal(str(data["cantidad"]))
    inv_obj.cantidad_actual = prev + delta
    inv_obj.necesita_reposicion = inv_obj.cantidad_actual <= inv_obj.cantidad_minima
    inv_obj.updated_at = _now()
    mov = ServiceInventoryMovement(
        company_id=UUID(company_id), stock_anterior=prev, stock_actual=inv_obj.cantidad_actual,
        **data,
    )
    db.add(mov)
    await db.commit()
    await db.refresh(mov)
    return {"id": str(mov.id), "product_id": str(mov.product_id), "tipo": mov.tipo, "cantidad": float(mov.cantidad),
            "stock_anterior": float(mov.stock_anterior or 0), "stock_actual": float(mov.stock_actual or 0), "created_at": mov.created_at}


async def list_inventory_movements(db: AsyncSession, company_id: str, technician_id: Optional[str] = None,
                                     product_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    from api.src.servicios.models import ServiceInventoryMovement
    q = select(ServiceInventoryMovement).where(ServiceInventoryMovement.company_id == UUID(company_id))
    if technician_id: q = q.where(ServiceInventoryMovement.technician_id == UUID(technician_id))
    if product_id: q = q.where(ServiceInventoryMovement.product_id == UUID(product_id))
    q = q.order_by(desc(ServiceInventoryMovement.created_at)).limit(limit)
    r = await db.execute(q)
    return [{
        "id": str(m.id), "technician_id": str(m.technician_id) if m.technician_id else None,
        "product_id": str(m.product_id), "work_order_id": str(m.work_order_id) if m.work_order_id else None,
        "tipo": m.tipo, "cantidad": float(m.cantidad),
        "stock_anterior": float(m.stock_anterior or 0), "stock_actual": float(m.stock_actual or 0),
        "created_at": m.created_at, "notas": m.notas,
    } for m in r.scalars().all()]


# ============================================================
# FACTURAS
# ============================================================

async def list_invoices(db: AsyncSession, company_id: str, estado: Optional[str] = None,
                         customer_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    from api.src.servicios.models import ServiceInvoice
    from api.src.customers.models import Customer
    q = select(ServiceInvoice).where(ServiceInvoice.company_id == UUID(company_id))
    if estado: q = q.where(ServiceInvoice.estado == estado)
    if customer_id: q = q.where(ServiceInvoice.customer_id == UUID(customer_id))
    q = q.order_by(desc(ServiceInvoice.fecha_emision)).limit(limit)
    r = await db.execute(q)
    out = []
    for inv in r.scalars().all():
        cust = await db.get(Customer, inv.customer_id) if inv.customer_id else None
        out.append({
            "id": str(inv.id), "numero": inv.numero,
            "customer_id": str(inv.customer_id), "customer_nombre": _customer_name(cust),
            "work_order_id": str(inv.work_order_id) if inv.work_order_id else None,
            "contract_id": str(inv.contract_id) if inv.contract_id else None,
            "estado": inv.estado, "fecha_emision": inv.fecha_emision,
            "fecha_vencimiento": inv.fecha_vencimiento,
            "total": float(inv.total or 0), "monto_pagado": float(inv.monto_pagado or 0),
            "saldo": float(inv.saldo or 0), "dias_mora": inv.dias_mora,
            "sifen_cdc": inv.sifen_cdc, "pdf_url": inv.pdf_url, "created_at": inv.created_at,
        })
    return out


async def get_invoice(db: AsyncSession, invoice_id: str) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import ServiceInvoice, InvoicePayment
    from api.src.customers.models import Customer
    try:
        iid = UUID(invoice_id)
    except ValueError:
        return None
    inv = await db.get(ServiceInvoice, iid)
    if not inv:
        return None
    cust = await db.get(Customer, inv.customer_id) if inv.customer_id else None
    pay_q = select(InvoicePayment).where(InvoicePayment.invoice_id == iid).order_by(InvoicePayment.fecha)
    pr = await db.execute(pay_q)
    payments = [{
        "id": str(p.id), "invoice_id": str(p.invoice_id), "fecha": p.fecha,
        "monto": float(p.monto or 0), "metodo_pago": p.metodo_pago,
        "referencia": p.referencia, "banco": p.banco, "notas": p.notas, "created_at": p.created_at,
    } for p in pr.scalars().all()]
    return {
        "id": str(inv.id), "company_id": str(inv.company_id), "numero": inv.numero,
        "customer_id": str(inv.customer_id), "customer_nombre": _customer_name(cust),
        "work_order_id": str(inv.work_order_id) if inv.work_order_id else None,
        "contract_id": str(inv.contract_id) if inv.contract_id else None,
        "estado": inv.estado, "fecha_emision": inv.fecha_emision,
        "fecha_vencimiento": inv.fecha_vencimiento, "plazo_pago_dias": inv.plazo_pago_dias,
        "subtotal": float(inv.subtotal or 0), "descuento": float(inv.descuento or 0),
        "iva": float(inv.iva or 0), "total": float(inv.total or 0),
        "monto_pagado": float(inv.monto_pagado or 0), "saldo": float(inv.saldo or 0),
        "dias_mora": inv.dias_mora, "metodo_pago": inv.metodo_pago,
        "sifen_cdc": inv.sifen_cdc, "sifen_xml_url": inv.sifen_xml_url, "pdf_url": inv.pdf_url,
        "payments": payments, "notas": inv.notas, "created_at": inv.created_at,
    }


async def register_payment(db: AsyncSession, company_id: str, invoice_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    from api.src.servicios.models import ServiceInvoice, InvoicePayment
    inv = await db.get(ServiceInvoice, UUID(invoice_id))
    if not inv:
        return None
    monto = Decimal(str(data["monto"]))
    pay = InvoicePayment(
        company_id=UUID(company_id), invoice_id=inv.id, fecha=data.get("fecha") or date.today(),
        monto=monto, metodo_pago=data["metodo_pago"], referencia=data.get("referencia"),
        banco=data.get("banco"), notas=data.get("notas"),
    )
    db.add(pay)
    inv.monto_pagado = (inv.monto_pagado or Decimal("0")) + monto
    inv.saldo = (inv.total or Decimal("0")) - inv.monto_pagado
    if inv.saldo <= 0:
        inv.estado = "pagada"
        inv.fecha_pago_total = date.today()
    elif inv.monto_pagado > 0:
        inv.estado = "parcial"
    await db.commit()
    await db.refresh(pay)
    return {"id": str(pay.id), "monto": float(pay.monto), "metodo_pago": pay.metodo_pago, "fecha": pay.fecha}


# ============================================================
# QUOTE REQUESTS (formulario publico)
# ============================================================

async def create_quote_request(db: AsyncSession, company_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import ServiceQuoteRequest
    qr = ServiceQuoteRequest(company_id=UUID(company_id), estado="nueva", **data)
    db.add(qr)
    await db.commit()
    await db.refresh(qr)
    return {"id": str(qr.id), "nombre": qr.nombre, "telefono": qr.telefono, "tipo_servicio": qr.tipo_servicio,
            "descripcion": qr.descripcion, "estado": qr.estado, "created_at": qr.created_at}


async def list_quote_requests(db: AsyncSession, company_id: str, estado: Optional[str] = None) -> List[Dict[str, Any]]:
    from api.src.servicios.models import ServiceQuoteRequest
    q = select(ServiceQuoteRequest).where(ServiceQuoteRequest.company_id == UUID(company_id))
    if estado: q = q.where(ServiceQuoteRequest.estado == estado)
    q = q.order_by(desc(ServiceQuoteRequest.created_at))
    r = await db.execute(q)
    return [{
        "id": str(qr.id), "nombre": qr.nombre, "telefono": qr.telefono, "email": qr.email,
        "tipo_servicio": qr.tipo_servicio, "descripcion": qr.descripcion, "estado": qr.estado,
        "urgencia": qr.urgencia, "fuente": qr.fuente, "ciudad": qr.ciudad, "created_at": qr.created_at,
    } for qr in r.scalars().all()]


# ============================================================
# REVIEWS
# ============================================================

async def add_review(db: AsyncSession, company_id: str, tech_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from api.src.servicios.models import TechnicianReview, Technician
    r = TechnicianReview(company_id=UUID(company_id), technician_id=UUID(tech_id), verificado=False, **data)
    db.add(r)
    # recalcular rating promedio
    qa = select(func.avg(TechnicianReview.rating)).where(TechnicianReview.technician_id == UUID(tech_id))
    ra = await db.execute(qa)
    avg = ra.scalar() or 5.0
    t = await db.get(Technician, UUID(tech_id))
    if t:
        t.rating_promedio = avg
    await db.commit()
    await db.refresh(r)
    return {"id": str(r.id), "rating": r.rating, "comentario": r.comentario, "created_at": r.created_at}


# ============================================================
# DASHBOARD
# ============================================================

async def build_dashboard(db: AsyncSession, company_id: str) -> Dict[str, Any]:
    from api.src.servicios.models import (Appointment, WorkOrder, Technician, ServiceContract,
                                            ServiceInvoice, InvoicePayment, ServiceQuoteRequest, TechnicianCertification)
    cid = UUID(company_id)
    hoy = date.today()
    inicio_mes = hoy.replace(day=1)

    # KPIs
    kpis = {}
    kpis["total_tecnicos"] = (await db.execute(select(func.count(Technician.id)).where(and_(Technician.company_id == cid, Technician.activo == True)))).scalar() or 0
    kpis["tecnicos_disponibles"] = (await db.execute(select(func.count(Technician.id)).where(and_(Technician.company_id == cid, Technician.activo == True, Technician.disponible == True)))).scalar() or 0
    kpis["citas_hoy"] = (await db.execute(select(func.count(Appointment.id)).where(and_(Appointment.company_id == cid, Appointment.fecha == hoy)))).scalar() or 0
    kpis["wo_en_progreso"] = (await db.execute(select(func.count(WorkOrder.id)).where(and_(WorkOrder.company_id == cid, WorkOrder.estado.in_(["en_camino", "en_sitio", "en_progreso"]))))).scalar() or 0
    kpis["wo_pendientes_facturar"] = (await db.execute(select(func.count(WorkOrder.id)).where(and_(WorkOrder.company_id == cid, WorkOrder.estado == "completada", WorkOrder.invoice_id.is_(None))))).scalar() or 0
    kpis["contratos_activos"] = (await db.execute(select(func.count(ServiceContract.id)).where(and_(ServiceContract.company_id == cid, ServiceContract.estado == "activo")))).scalar() or 0
    kpis["quote_requests_nuevas"] = (await db.execute(select(func.count(ServiceQuoteRequest.id)).where(and_(ServiceQuoteRequest.company_id == cid, ServiceQuoteRequest.estado == "nueva")))).scalar() or 0

    # Revenue del mes
    rev = (await db.execute(select(func.coalesce(func.sum(ServiceInvoice.total), 0)).where(and_(
        ServiceInvoice.company_id == cid, ServiceInvoice.fecha_emision >= inicio_mes, ServiceInvoice.estado != "anulada")))).scalar() or 0
    cobr = (await db.execute(select(func.coalesce(func.sum(InvoicePayment.monto), 0)).where(and_(
        InvoicePayment.company_id == cid, InvoicePayment.fecha >= inicio_mes)))).scalar() or 0
    revenue_mes = {"facturado_mes": float(rev), "cobrado_mes": float(cobr), "pendiente_cobro_mes": float(rev) - float(cobr)}

    # agenda de hoy
    agenda_hoy = await list_appointments(db, company_id, fecha_desde=hoy, fecha_hasta=hoy)

    # WO en progreso
    wo_prog_q = select(WorkOrder).where(and_(WorkOrder.company_id == cid, WorkOrder.estado.in_(["en_camino", "en_sitio", "en_progreso"]))).order_by(WorkOrder.fecha_programada).limit(10)
    wo_prog = []
    r = await db.execute(wo_prog_q)
    for wo in r.scalars().all():
        d = await get_work_order(db, str(wo.id))
        if d: wo_prog.append(d)

    # certificaciones por vencer (30 dias)
    cert_alerts = await check_expiring_certifications(db, company_id)

    # top tecnicos (por ingresos generados)
    top_q = (select(Technician.nombre, Technician.id,
                      func.coalesce(func.sum(WorkOrder.total), 0).label("revenue"),
                      func.count(WorkOrder.id).label("wo_count"))
             .join(WorkOrder, WorkOrder.technician_id == Technician.id)
             .where(and_(Technician.company_id == cid, WorkOrder.fecha_programada >= inicio_mes))
             .group_by(Technician.id, Technician.nombre)
             .order_by(desc("revenue"))
             .limit(5))
    r = await db.execute(top_q)
    top = [{"technician_id": str(t.id), "nombre": t.nombre, "revenue": float(t.revenue or 0), "wo_count": t.wo_count} for t in r.all()]

    # aging de facturas
    aging = {"0_30": {"count": 0, "monto": 0}, "31_60": {"count": 0, "monto": 0}, "61_90": {"count": 0, "monto": 0}, "90_plus": {"count": 0, "monto": 0}}
    for inv in (await db.execute(select(ServiceInvoice).where(and_(ServiceInvoice.company_id == cid, ServiceInvoice.estado.in_(["emitida", "parcial", "vencida"]))))).scalars().all():
        dias = (date.today() - inv.fecha_emision).days
        sal = float(inv.saldo or 0)
        if dias <= 30: aging["0_30"]["count"] += 1; aging["0_30"]["monto"] += sal
        elif dias <= 60: aging["31_60"]["count"] += 1; aging["31_60"]["monto"] += sal
        elif dias <= 90: aging["61_90"]["count"] += 1; aging["61_90"]["monto"] += sal
        else: aging["90_plus"]["count"] += 1; aging["90_plus"]["monto"] += sal

    # contratos por vencer
    cont_q = select(ServiceContract).where(and_(ServiceContract.company_id == cid, ServiceContract.fecha_fin.isnot(None), ServiceContract.fecha_fin <= hoy + timedelta(days=30), ServiceContract.estado == "activo")).limit(5)
    rc = await db.execute(cont_q)
    contratos_vencer = []
    for c in rc.scalars().all():
        d = await get_contract(db, str(c.id))
        if d: contratos_vencer.append(d)

    # queue de quote requests
    qr_q = select(ServiceQuoteRequest).where(and_(ServiceQuoteRequest.company_id == cid, ServiceQuoteRequest.estado == "nueva")).order_by(ServiceQuoteRequest.created_at).limit(5)
    rqr = await db.execute(qr_q)
    queue_qr = [{
        "id": str(qr.id), "nombre": qr.nombre, "telefono": qr.telefono, "email": qr.email,
        "tipo_servicio": qr.tipo_servicio, "descripcion": qr.descripcion, "estado": qr.estado,
        "urgencia": qr.urgencia, "fuente": qr.fuente, "ciudad": qr.ciudad, "created_at": qr.created_at,
    } for qr in rqr.scalars().all()]

    return {
        "kpis_principales": kpis,
        "agenda_hoy": agenda_hoy,
        "wo_en_progreso": wo_prog,
        "alertas_certificaciones": cert_alerts,
        "top_tecnicos": top,
        "revenue_mes": revenue_mes,
        "aging_facturas": aging,
        "contratos_por_vencer": contratos_vencer,
        "queue_quote_requests": queue_qr,
    }


# ============================================================
# TIME TRACKING
# ============================================================

async def start_timer(db: AsyncSession, company_id: str, work_order_id: str, technician_id: str, tipo: str = "trabajo") -> Dict[str, Any]:
    from api.src.servicios.models import TimeEntry
    te = TimeEntry(
        company_id=UUID(company_id), work_order_id=UUID(work_order_id),
        technician_id=UUID(technician_id), tipo=tipo, inicio=_now(),
    )
    db.add(te)
    await db.commit()
    await db.refresh(te)
    return {"id": str(te.id), "inicio": te.inicio.isoformat()}


async def stop_timer(db: AsyncSession, timer_id: str, facturable: bool = True) -> Dict[str, Any]:
    from api.src.servicios.models import TimeEntry
    te = await db.get(TimeEntry, UUID(timer_id))
    if not te:
        return None
    te.fin = _now()
    delta = te.fin - te.inicio
    te.duracion_minutos = int(delta.total_seconds() / 60)
    te.facturable = facturable
    await db.commit()
    return {"id": str(te.id), "duracion_minutos": te.duracion_minutos}
