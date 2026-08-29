"""Service layer for Donations & Round-Up Engine"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, update, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.donaciones.models import DonationCampaign, DonationRecord, DonationLiquidation
from api.src.donaciones.schemas import (
    DonationCampaignCreate,
    DonationCampaignUpdate,
    DonationRecordCreate,
    DonationLiquidationCreate,
    DonationStatsResponse,
    CajeroSolidarioRankingItem,
)
from api.src.sales.models import Sale


async def get_or_create_default_campaign(db: AsyncSession, company_id: str) -> DonationCampaign:
    """Obtiene la campaña activa de la empresa o crea la campaña oficial 'Abre tu corazón' por defecto"""
    comp_uuid = uuid.UUID(company_id)
    res = await db.execute(
        select(DonationCampaign)
        .where(DonationCampaign.company_id == comp_uuid, DonationCampaign.activa == True)
        .order_by(DonationCampaign.created_at.desc())
        .limit(1)
    )
    camp = res.scalar_one_or_none()
    if camp:
        return camp

    # Crear campaña oficial institucional
    camp = DonationCampaign(
        company_id=comp_uuid,
        nombre="Abre tu corazón",
        ong_nombre="Centro Amor y Esperanza",
        ong_web="www.centroamoresperanza.org",
        slogan="Ayudanos a ayudar",
        mensaje_ticket="¡Gracias por abrir tu corazón! Colaboraste con {monto} para el Centro Amor y Esperanza.",
        meta_recaudacion_pyg=Decimal("20000000"),
        activa=True,
    )
    db.add(camp)
    await db.commit()
    await db.refresh(camp)
    return camp


async def get_active_campaign(db: AsyncSession, company_id: str) -> DonationCampaign:
    return await get_or_create_default_campaign(db, company_id)


async def update_campaign(db: AsyncSession, campaign_id: str, data: DonationCampaignUpdate) -> DonationCampaign | None:
    camp_uuid = uuid.UUID(campaign_id)
    res = await db.execute(select(DonationCampaign).where(DonationCampaign.id == camp_uuid))
    camp = res.scalar_one_or_none()
    if not camp:
        return None

    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(camp, k, v)

    await db.commit()
    await db.refresh(camp)
    return camp


async def record_donation(db: AsyncSession, data: DonationRecordCreate) -> DonationRecord:
    """Registra una micro-donación/redondeo en el punto de venta"""
    # Si no se pasó campana_id, buscar la activa
    campana_id = data.campana_id
    if not campana_id:
        camp = await get_or_create_default_campaign(db, str(data.company_id))
        campana_id = camp.id

    rec = DonationRecord(
        company_id=data.company_id,
        branch_id=data.branch_id,
        sale_id=data.sale_id,
        session_id=data.session_id,
        user_id=data.user_id,
        cajero_nombre=data.cajero_nombre or "Cajero",
        campana_id=campana_id,
        monto_pyg=Decimal(str(data.monto_pyg)),
        monto_total_venta_pyg=Decimal(str(data.monto_total_venta_pyg)),
        numero_comprobante=data.numero_comprobante,
        tipo_origen=data.tipo_origen,
        estado="recaudado",
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


async def get_donation_stats(db: AsyncSession, company_id: str, branch_id: str | None = None) -> DonationStatsResponse:
    """Calcula las métricas consolidadas de donación y progreso hacia la meta"""
    comp_uuid = uuid.UUID(company_id)
    camp = await get_or_create_default_campaign(db, company_id)

    now = datetime.now(timezone.utc)
    inicio_mes = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    inicio_hoy = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    # Base query
    base_filter = [DonationRecord.company_id == comp_uuid, DonationRecord.estado != "anulado"]
    if branch_id:
        base_filter.append(DonationRecord.branch_id == uuid.UUID(branch_id))

    # Total recaudado histórico
    q_tot = select(
        func.coalesce(func.sum(DonationRecord.monto_pyg), 0).label("total"),
        func.count(DonationRecord.id).label("count")
    ).where(*base_filter)
    r_tot = (await db.execute(q_tot)).one()
    total_recaudado = Decimal(str(r_tot.total or 0))
    cantidad_donaciones = int(r_tot.count or 0)

    # Total este mes
    q_mes = select(func.coalesce(func.sum(DonationRecord.monto_pyg), 0)).where(
        *base_filter, DonationRecord.created_at >= inicio_mes
    )
    total_mes = Decimal(str((await db.execute(q_mes)).scalar() or 0))

    # Total hoy
    q_hoy = select(func.coalesce(func.sum(DonationRecord.monto_pyg), 0)).where(
        *base_filter, DonationRecord.created_at >= inicio_hoy
    )
    total_hoy = Decimal(str((await db.execute(q_hoy)).scalar() or 0))

    # Total liquidado
    q_liq = select(func.coalesce(func.sum(DonationRecord.monto_pyg), 0)).where(
        *base_filter, DonationRecord.estado == "liquidado"
    )
    total_liquidado = Decimal(str((await db.execute(q_liq)).scalar() or 0))

    total_pendiente = total_recaudado - total_liquidado
    ticket_promedio = (total_recaudado / Decimal(cantidad_donaciones)) if cantidad_donaciones > 0 else Decimal(0)

    meta = camp.meta_recaudacion_pyg if camp else Decimal(20000000)
    progreso_pct = float(min(Decimal(100), (total_recaudado / meta * 100))) if meta > 0 else 0.0

    return DonationStatsResponse(
        total_recaudado_pyg=total_recaudado,
        total_mes_pyg=total_mes,
        total_hoy_pyg=total_hoy,
        total_liquidado_pyg=total_liquidado,
        total_pendiente_pyg=total_pendiente,
        cantidad_donaciones=cantidad_donaciones,
        ticket_promedio_donacion=ticket_promedio.quantize(Decimal("1")),
        meta_pyg=meta,
        progreso_meta_pct=round(progreso_pct, 1),
        campana_activa=camp,
    )


async def get_cajeros_ranking(
    db: AsyncSession,
    company_id: str,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
) -> list[CajeroSolidarioRankingItem]:
    """Genera el ranking de cajeros solidarios con tasa de conversión de redondeo"""
    comp_uuid = uuid.UUID(company_id)

    don_filter = [DonationRecord.company_id == comp_uuid, DonationRecord.estado != "anulado"]
    sale_filter = [Sale.company_id == comp_uuid, Sale.estado == "confirmado"]

    if fecha_desde:
        don_filter.append(DonationRecord.created_at >= fecha_desde)
        sale_filter.append(Sale.fecha >= fecha_desde)
    if fecha_hasta:
        don_filter.append(DonationRecord.created_at <= fecha_hasta)
        sale_filter.append(Sale.fecha <= fecha_hasta)

    # 1. Total ventas por cajero / user_id
    sales_q = select(
        Sale.user_id,
        func.count(Sale.id).label("total_ventas")
    ).where(*sale_filter).group_by(Sale.user_id)
    sales_res = (await db.execute(sales_q)).all()
    sales_by_user = {str(row.user_id): row.total_ventas for row in sales_res if row.user_id}

    # 2. Donaciones por cajero / user_id
    don_q = select(
        DonationRecord.user_id,
        DonationRecord.cajero_nombre,
        func.coalesce(func.sum(DonationRecord.monto_pyg), 0).label("total_monto"),
        func.count(DonationRecord.id).label("total_count")
    ).where(*don_filter).group_by(DonationRecord.user_id, DonationRecord.cajero_nombre).order_by(desc("total_monto"))
    
    don_res = (await db.execute(don_q)).all()

    ranking: list[CajeroSolidarioRankingItem] = []
    for row in don_res:
        u_id = str(row.user_id) if row.user_id else None
        ventas_tot = sales_by_user.get(u_id, row.total_count)
        if ventas_tot < row.total_count:
            ventas_tot = row.total_count

        tasa = (row.total_count / ventas_tot * 100) if ventas_tot > 0 else 0.0

        ranking.append(
            CajeroSolidarioRankingItem(
                user_id=row.user_id,
                cajero_nombre=row.cajero_nombre or "Cajero",
                total_recaudado_pyg=Decimal(str(row.total_monto or 0)),
                cantidad_donaciones=row.total_count,
                total_ventas_atendidas=ventas_tot,
                tasa_adhesion_pct=round(tasa, 1),
            )
        )

    return ranking


async def list_recent_donations(db: AsyncSession, company_id: str, limit: int = 50) -> list[DonationRecord]:
    comp_uuid = uuid.UUID(company_id)
    res = await db.execute(
        select(DonationRecord)
        .where(DonationRecord.company_id == comp_uuid)
        .order_by(DonationRecord.created_at.desc())
        .limit(limit)
    )
    return list(res.scalars().all())


async def list_liquidations(db: AsyncSession, company_id: str) -> list[DonationLiquidation]:
    comp_uuid = uuid.UUID(company_id)
    res = await db.execute(
        select(DonationLiquidation)
        .where(DonationLiquidation.company_id == comp_uuid)
        .order_by(DonationLiquidation.created_at.desc())
    )
    return list(res.scalars().all())


async def create_liquidation(db: AsyncSession, data: DonationLiquidationCreate) -> DonationLiquidation:
    """Genera una entrega formal de fondos a la ONG y marca los registros recaudados como liquidados"""
    # 1. Buscar donaciones pendientes en el rango de fechas
    query = select(DonationRecord).where(
        DonationRecord.company_id == data.company_id,
        DonationRecord.campana_id == data.campana_id,
        DonationRecord.estado == "recaudado",
        DonationRecord.created_at >= data.fecha_desde,
        DonationRecord.created_at <= data.fecha_hasta,
    )
    records = list((await db.execute(query)).scalars().all())

    total_monto = sum(Decimal(str(r.monto_pyg)) for r in records)
    cant_donaciones = len(records)

    # 2. Generar correlativo de Acta
    year = datetime.now().year
    count_actas_q = select(func.count(DonationLiquidation.id)).where(DonationLiquidation.company_id == data.company_id)
    nro_seq = int((await db.execute(count_actas_q)).scalar() or 0) + 1
    numero_acta = f"ACTA-AMOR-ESP-{year}-{nro_seq:04d}"

    # 3. Crear liquidación
    liq = DonationLiquidation(
        company_id=data.company_id,
        campana_id=data.campana_id,
        monto_total_pyg=total_monto,
        cantidad_donaciones=cant_donaciones,
        fecha_desde=data.fecha_desde,
        fecha_hasta=data.fecha_hasta,
        numero_acta=numero_acta,
        entregado_por_nombre=data.entregado_por_nombre,
        recibido_por_nombre=data.recibido_por_nombre,
        recibido_por_ci=data.recibido_por_ci,
        comprobante_transferencia=data.comprobante_transferencia,
        observaciones=data.observaciones,
        estado="entregado",
    )
    db.add(liq)

    # 4. Actualizar estado de las donaciones
    for r in records:
        r.estado = "liquidado"

    await db.commit()
    await db.refresh(liq)
    return liq
