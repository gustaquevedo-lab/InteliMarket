"""CRM service"""

from sqlalchemy import select, func as sql_func, and_, cast, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from api.src.crm.models import Lead, Oportunidad, Actividad, ActividadRealizada
from api.src.crm.schemas import (
    LeadCreate, LeadUpdate,
    OportunidadCreate, OportunidadUpdate, EtapaOportunidad,
    ActividadCreate, ActividadUpdate,
    ActividadRealizadaCreate,
    PipelineStats, PipelineStatsEtapa,
    LeadStats, LeadStatsEstado,
    ActivityStats, ActivityStatsTipo,
)


async def get_leads(db: AsyncSession, tenant_id: uuid.UUID, company_id: uuid.UUID) -> list[Lead]:
    result = await db.execute(
        select(Lead)
        .where(Lead.tenant_id == tenant_id)
        .order_by(Lead.created_at.desc())
    )
    return list(result.scalars().all())


async def get_lead(db: AsyncSession, tenant_id: uuid.UUID, lead_id: uuid.UUID) -> Lead | None:
    result = await db.execute(
        select(Lead).where(and_(Lead.id == lead_id, Lead.tenant_id == tenant_id))
    )
    return result.scalar_one_or_none()


async def create_lead(db: AsyncSession, tenant_id: uuid.UUID, company_id: uuid.UUID, data: LeadCreate) -> Lead:
    lead = Lead(tenant_id=tenant_id, company_id=company_id, **data.model_dump())
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


async def update_lead(db: AsyncSession, tenant_id: uuid.UUID, lead_id: uuid.UUID, data: LeadUpdate) -> Lead | None:
    lead = await get_lead(db, tenant_id, lead_id)
    if not lead:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lead, key, value)
    await db.commit()
    await db.refresh(lead)
    return lead


async def delete_lead(db: AsyncSession, tenant_id: uuid.UUID, lead_id: uuid.UUID) -> bool:
    lead = await get_lead(db, tenant_id, lead_id)
    if not lead:
        return False
    await db.delete(lead)
    await db.commit()
    return True


async def get_oportunidades(db: AsyncSession, tenant_id: uuid.UUID, company_id: uuid.UUID) -> list[Oportunidad]:
    result = await db.execute(
        select(Oportunidad)
        .where(Oportunidad.tenant_id == tenant_id)
        .order_by(Oportunidad.created_at.desc())
    )
    return list(result.scalars().all())


async def get_oportunidad(db: AsyncSession, tenant_id: uuid.UUID, opp_id: uuid.UUID) -> Oportunidad | None:
    result = await db.execute(
        select(Oportunidad).where(and_(Oportunidad.id == opp_id, Oportunidad.tenant_id == tenant_id))
    )
    return result.scalar_one_or_none()


async def create_oportunidad(db: AsyncSession, tenant_id: uuid.UUID, company_id: uuid.UUID, data: OportunidadCreate) -> Oportunidad:
    opp = Oportunidad(tenant_id=tenant_id, company_id=company_id, **data.model_dump())
    db.add(opp)
    await db.commit()
    await db.refresh(opp)
    return opp


async def update_oportunidad(db: AsyncSession, tenant_id: uuid.UUID, opp_id: uuid.UUID, data: OportunidadUpdate) -> Oportunidad | None:
    opp = await get_oportunidad(db, tenant_id, opp_id)
    if not opp:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(opp, key, value)
    await db.commit()
    await db.refresh(opp)
    return opp


async def delete_oportunidad(db: AsyncSession, tenant_id: uuid.UUID, opp_id: uuid.UUID) -> bool:
    opp = await get_oportunidad(db, tenant_id, opp_id)
    if not opp:
        return False
    await db.delete(opp)
    await db.commit()
    return True


async def move_oportunidad_etapa(db: AsyncSession, tenant_id: uuid.UUID, opp_id: uuid.UUID, etapa: EtapaOportunidad) -> Oportunidad | None:
    opp = await get_oportunidad(db, tenant_id, opp_id)
    if not opp:
        return None
    opp.etapa = etapa.value
    await db.commit()
    await db.refresh(opp)
    return opp


async def get_actividades(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    oportunidad_id: uuid.UUID | None = None,
    lead_id: uuid.UUID | None = None,
) -> list[Actividad]:
    query = select(Actividad).where(Actividad.tenant_id == tenant_id)
    if oportunidad_id:
        query = query.where(Actividad.oportunidad_id == oportunidad_id)
    if lead_id:
        query = query.where(Actividad.lead_id == lead_id)
    query = query.order_by(Actividad.fecha.desc(), Actividad.hora.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_actividad(db: AsyncSession, tenant_id: uuid.UUID, actividad_id: uuid.UUID) -> Actividad | None:
    result = await db.execute(
        select(Actividad).where(and_(Actividad.id == actividad_id, Actividad.tenant_id == tenant_id))
    )
    return result.scalar_one_or_none()


async def create_actividad(db: AsyncSession, tenant_id: uuid.UUID, data: ActividadCreate) -> Actividad:
    actividad = Actividad(tenant_id=tenant_id, **data.model_dump())
    db.add(actividad)
    await db.commit()
    await db.refresh(actividad)
    return actividad


async def update_actividad(db: AsyncSession, tenant_id: uuid.UUID, actividad_id: uuid.UUID, data: ActividadUpdate) -> Actividad | None:
    actividad = await get_actividad(db, tenant_id, actividad_id)
    if not actividad:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(actividad, key, value)
    await db.commit()
    await db.refresh(actividad)
    return actividad


async def complete_actividad(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    actividad_id: uuid.UUID,
    user_id: uuid.UUID,
    notas: str | None = None,
) -> Actividad | None:
    actividad = await get_actividad(db, tenant_id, actividad_id)
    if not actividad:
        return None
    actividad.completada = True
    realizada = ActividadRealizada(
        tenant_id=tenant_id,
        actividad_id=actividad_id,
        user_id=user_id,
        notas=notas,
    )
    db.add(realizada)
    await db.commit()
    await db.refresh(actividad)
    return actividad


async def get_pipeline_stats(db: AsyncSession, tenant_id: uuid.UUID) -> PipelineStats:
    etapas_query = await db.execute(
        select(
            Oportunidad.etapa,
            sql_func.count(Oportunidad.id).label("cantidad"),
            sql_func.coalesce(sql_func.sum(Oportunidad.monto_estimado), 0).label("monto_total"),
        )
        .where(Oportunidad.tenant_id == tenant_id)
        .group_by(Oportunidad.etapa)
    )
    etapas_rows = etapas_query.all()

    total_query = await db.execute(
        select(
            sql_func.count(Oportunidad.id).label("total"),
            sql_func.coalesce(sql_func.sum(Oportunidad.monto_estimado), 0).label("monto_total"),
        )
        .where(Oportunidad.tenant_id == tenant_id)
    )
    total_row = total_query.one()

    ganado_query = await db.execute(
        select(sql_func.coalesce(sql_func.sum(Oportunidad.monto_estimado), 0).label("monto_ganado"))
        .where(and_(Oportunidad.tenant_id == tenant_id, Oportunidad.etapa == "cerrado_ganado"))
    )
    monto_ganado = ganado_query.scalar() or 0.0

    etapas = [
        PipelineStatsEtapa(
            etapa=row.etapa,
            cantidad=row.cantidad,
            monto_total=float(row.monto_total),
            monto_ganado=float(monto_ganado) if row.etapa == "cerrado_ganado" else 0.0,
        )
        for row in etapas_rows
    ]

    return PipelineStats(
        total_oportunidades=total_row.total,
        monto_total=float(total_row.monto_total),
        monto_ganado=float(monto_ganado),
        etapas=etapas,
    )


async def get_lead_stats(db: AsyncSession, tenant_id: uuid.UUID) -> LeadStats:
    count_result = await db.execute(
        select(sql_func.count(Lead.id)).where(Lead.tenant_id == tenant_id)
    )
    total = count_result.scalar() or 0

    avg_result = await db.execute(
        select(sql_func.coalesce(sql_func.avg(Lead.puntaje), 0)).where(Lead.tenant_id == tenant_id)
    )
    avg_puntaje = avg_result.scalar() or 0.0

    estado_result = await db.execute(
        select(Lead.estado, sql_func.count(Lead.id).label("cantidad"))
        .where(Lead.tenant_id == tenant_id)
        .group_by(Lead.estado)
    )
    por_estado = [
        LeadStatsEstado(estado=row.estado, cantidad=row.cantidad) for row in estado_result.all()
    ]

    return LeadStats(total=total, promedio_puntaje=float(avg_puntaje), por_estado=por_estado)


async def get_activity_stats(db: AsyncSession, tenant_id: uuid.UUID) -> ActivityStats:
    total_result = await db.execute(
        select(sql_func.count(Actividad.id)).where(Actividad.tenant_id == tenant_id)
    )
    total = total_result.scalar() or 0

    completadas_result = await db.execute(
        select(sql_func.count(Actividad.id)).where(
            and_(Actividad.tenant_id == tenant_id, Actividad.completada == True)
        )
    )
    completadas = completadas_result.scalar() or 0

    tipo_result = await db.execute(
        select(
            Actividad.tipo,
            sql_func.count(Actividad.id).label("total"),
            sql_func.sum(sql_func.cast(Actividad.completada, Integer)).label("completadas"),
        )
        .where(Actividad.tenant_id == tenant_id)
        .group_by(Actividad.tipo)
    )
    por_tipo = [
        ActivityStatsTipo(
            tipo=row.tipo,
            total=row.total,
            completadas=row.completadas or 0,
        )
        for row in tipo_result.all()
    ]

    return ActivityStats(total=total, completadas=completadas, pendientes=total - completadas, por_tipo=por_tipo)
