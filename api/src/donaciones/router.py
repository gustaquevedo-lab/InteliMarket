"""FastAPI Router for Donations & Round-Up Engine (Abre tu corazón - Centro Amor y Esperanza)"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.donaciones import service, schemas

DEFAULT_COMPANY_ID = UUID("00000000-0000-0000-0000-000000000010")

router = APIRouter(prefix="/api/v1/donaciones", tags=["Donaciones & Redondeo Solidario (RSE)"])


@router.get("/campana-activa", response_model=schemas.DonationCampaignResponse)
async def get_active_campaign(
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """Retorna la campaña de donación activa para el POS y la plataforma"""
    cid = company_id or str(DEFAULT_COMPANY_ID)
    return await service.get_or_create_default_campaign(db, cid)


@router.put("/campana/{campaign_id}", response_model=schemas.DonationCampaignResponse)
async def update_campaign(
    campaign_id: str,
    payload: schemas.DonationCampaignUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Actualiza los parámetros de la campaña (meta, web, eslogan, etc.)"""
    camp = await service.update_campaign(db, campaign_id, payload)
    if not camp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada")
    return camp


@router.post("/registrar", response_model=schemas.DonationRecordResponse)
async def record_donation(
    payload: schemas.DonationRecordCreate,
    db: AsyncSession = Depends(get_db)
):
    """Registra una micro-donación/redondeo procedente de una venta en POS"""
    return await service.record_donation(db, payload)


@router.get("/stats", response_model=schemas.DonationStatsResponse)
async def get_donation_stats(
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    branch_id: Optional[str] = Query(None, description="UUID de sucursal"),
    db: AsyncSession = Depends(get_db)
):
    """Métricas consolidadas en tiempo real: recaudación total, mes, hoy, avance de meta y tickets promedio"""
    cid = company_id or str(DEFAULT_COMPANY_ID)
    return await service.get_donation_stats(db, cid, branch_id)


@router.get("/ranking-cajeros", response_model=List[schemas.CajeroSolidarioRankingItem])
async def get_cajeros_ranking(
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Ranking de cajeros con mayor recaudación y tasa de conversión de redondeo"""
    cid = company_id or str(DEFAULT_COMPANY_ID)
    return await service.get_cajeros_ranking(db, cid, fecha_desde, fecha_hasta)


@router.get("/historial", response_model=List[schemas.DonationRecordResponse])
async def list_recent_donations(
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Listado cronológico de micro-donaciones registradas"""
    cid = company_id or str(DEFAULT_COMPANY_ID)
    return await service.list_recent_donations(db, cid, limit)


@router.get("/liquidaciones", response_model=List[schemas.DonationLiquidationResponse])
async def list_liquidations(
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """Historial de entregas y transferencias formalizadas a la ONG"""
    cid = company_id or str(DEFAULT_COMPANY_ID)
    return await service.list_liquidations(db, cid)


@router.post("/liquidar", response_model=schemas.DonationLiquidationResponse)
async def create_liquidation(
    payload: schemas.DonationLiquidationCreate,
    db: AsyncSession = Depends(get_db)
):
    """Genera un acta formal de entrega de fondos al Centro Amor y Esperanza"""
    return await service.create_liquidation(db, payload)
