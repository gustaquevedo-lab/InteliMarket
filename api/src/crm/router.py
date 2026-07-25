"""CRM router"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.crm import service
from api.src.crm.schemas import (
    LeadCreate, LeadUpdate, LeadResponse,
    OportunidadCreate, OportunidadUpdate, OportunidadResponse, EtapaUpdate,
    ActividadCreate, ActividadUpdate, ActividadResponse,
    ActividadRealizadaCreate, ActividadRealizadaResponse,
    PipelineStats, LeadStats, ActivityStats,
)

router = APIRouter(prefix="/api/v1/crm", tags=["CRM"])


@router.get("/leads", response_model=list[LeadResponse])
async def get_leads(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    company_id = uuid.UUID(user["company_id"])
    return await service.get_leads(db, tenant_id, company_id)


@router.post("/leads", response_model=LeadResponse)
async def create_lead(
    data: LeadCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    company_id = uuid.UUID(user["company_id"])
    return await service.create_lead(db, tenant_id, company_id, data)


@router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    lead = await service.get_lead(db, tenant_id, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.put("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: uuid.UUID,
    data: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    lead = await service.update_lead(db, tenant_id, lead_id, data)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.delete("/leads/{lead_id}")
async def delete_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    success = await service.delete_lead(db, tenant_id, lead_id)
    if not success:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted"}


@router.get("/oportunidades", response_model=list[OportunidadResponse])
async def get_oportunidades(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    company_id = uuid.UUID(user["company_id"])
    return await service.get_oportunidades(db, tenant_id, company_id)


@router.post("/oportunidades", response_model=OportunidadResponse)
async def create_oportunidad(
    data: OportunidadCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    company_id = uuid.UUID(user["company_id"])
    return await service.create_oportunidad(db, tenant_id, company_id, data)


@router.get("/oportunidades/{opp_id}", response_model=OportunidadResponse)
async def get_oportunidad(
    opp_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    opp = await service.get_oportunidad(db, tenant_id, opp_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Oportunidad not found")
    return opp


@router.put("/oportunidades/{opp_id}", response_model=OportunidadResponse)
async def update_oportunidad(
    opp_id: uuid.UUID,
    data: OportunidadUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    opp = await service.update_oportunidad(db, tenant_id, opp_id, data)
    if not opp:
        raise HTTPException(status_code=404, detail="Oportunidad not found")
    return opp


@router.delete("/oportunidades/{opp_id}")
async def delete_oportunidad(
    opp_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    success = await service.delete_oportunidad(db, tenant_id, opp_id)
    if not success:
        raise HTTPException(status_code=404, detail="Oportunidad not found")
    return {"message": "Oportunidad deleted"}


@router.put("/oportunidades/{opp_id}/etapa", response_model=OportunidadResponse)
async def move_oportunidad_etapa(
    opp_id: uuid.UUID,
    data: EtapaUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    opp = await service.move_oportunidad_etapa(db, tenant_id, opp_id, data.etapa)
    if not opp:
        raise HTTPException(status_code=404, detail="Oportunidad not found")
    return opp


@router.get("/actividades", response_model=list[ActividadResponse])
async def get_actividades(
    oportunidad_id: Optional[uuid.UUID] = None,
    lead_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    return await service.get_actividades(db, tenant_id, oportunidad_id, lead_id)


@router.post("/actividades", response_model=ActividadResponse)
async def create_actividad(
    data: ActividadCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    return await service.create_actividad(db, tenant_id, data)


@router.get("/actividades/{actividad_id}", response_model=ActividadResponse)
async def get_actividad(
    actividad_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    actividad = await service.get_actividad(db, tenant_id, actividad_id)
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad not found")
    return actividad


@router.put("/actividades/{actividad_id}", response_model=ActividadResponse)
async def update_actividad(
    actividad_id: uuid.UUID,
    data: ActividadUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    actividad = await service.update_actividad(db, tenant_id, actividad_id, data)
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad not found")
    return actividad


@router.delete("/actividades/{actividad_id}")
async def delete_actividad(
    actividad_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    actividad = await service.get_actividad(db, tenant_id, actividad_id)
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad not found")
    await db.delete(actividad)
    await db.commit()
    return {"message": "Actividad deleted"}


@router.post("/actividades/{actividad_id}/complete", response_model=ActividadResponse)
async def complete_actividad(
    actividad_id: uuid.UUID,
    data: ActividadRealizadaCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    user_id = uuid.UUID(user["id"])
    actividad = await service.complete_actividad(db, tenant_id, actividad_id, user_id, data.notas)
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad not found")
    return actividad


@router.get("/stats/leads", response_model=LeadStats)
async def get_lead_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    return await service.get_lead_stats(db, tenant_id)


@router.get("/stats/pipeline", response_model=PipelineStats)
async def get_pipeline_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    return await service.get_pipeline_stats(db, tenant_id)


@router.get("/stats/activities", response_model=ActivityStats)
async def get_activity_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    return await service.get_activity_stats(db, tenant_id)
