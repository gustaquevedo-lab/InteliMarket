"""Service for Institutional Vouchers (Vales Institucionales / Convenios)"""

import re
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID
import uuid as uuid_mod

from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.vouchers.models import InstitutionalVoucher
from api.src.vouchers.schemas import (
    VoucherCheckResponse,
    VoucherRedeemResponse,
    ConvenioSummaryResponse,
    VoucherItemSummary,
)


def normalize_barcode(raw: str) -> list[str]:
    """Genera variantes de búsqueda para códigos de barra de vales.
    Soporta '001', 'VALE 001', 'VALE N.º 001', 'VALE-001', etc.
    """
    clean = raw.strip()
    candidates = [clean, clean.upper()]

    # Extraer dígitos
    digits_match = re.search(r"(\d+)", clean)
    if digits_match:
        digits = digits_match.group(1)
        # Formato de 3 dígitos (ej: 001)
        pad3 = digits.zfill(3)
        candidates.extend([
            pad3,
            f"VALE-{pad3}",
            f"VALE {pad3}",
            f"VALE N.º {pad3}",
            f"VALE N° {pad3}",
            digits,
        ])

    return list(dict.fromkeys(candidates))


async def check_voucher(
    db: AsyncSession,
    company_id: UUID,
    barcode_or_number: str,
) -> VoucherCheckResponse:
    """Valida si un vale existe, está activo y no ha vencido."""
    variants = normalize_barcode(barcode_or_number)

    stmt = select(InstitutionalVoucher).where(
        InstitutionalVoucher.company_id == company_id,
        or_(
            InstitutionalVoucher.codigo_barras.in_(variants),
            InstitutionalVoucher.numero_vale.in_(variants),
        ),
    )
    res = await db.execute(stmt)
    voucher = res.scalars().first()

    if not voucher:
        return VoucherCheckResponse(
            id=uuid_mod.UUID("00000000-0000-0000-0000-000000000000"),
            convenio_nombre="Desconocido",
            numero_vale="---",
            codigo_barras=barcode_or_number,
            monto_inicial=Decimal("0"),
            saldo_disponible=Decimal("0"),
            estado="NO_EXISTE",
            fecha_vencimiento=date.today(),
            es_valido=False,
            mensaje=f"El vale '{barcode_or_number}' no está registrado en el sistema.",
        )

    today = date.today()
    if voucher.fecha_vencimiento < today:
        return VoucherCheckResponse(
            id=voucher.id,
            convenio_nombre=voucher.convenio_nombre,
            numero_vale=voucher.numero_vale,
            codigo_barras=voucher.codigo_barras,
            monto_inicial=voucher.monto_inicial,
            saldo_disponible=voucher.saldo_disponible,
            estado="VENCIDO",
            fecha_vencimiento=voucher.fecha_vencimiento,
            es_valido=False,
            mensaje=f"El vale N° {voucher.numero_vale} venció el {voucher.fecha_vencimiento.strftime('%d/%m/%Y')}.",
            beneficiario_nombre=voucher.beneficiario_nombre,
        )

    if voucher.estado != "ACTIVO" or voucher.saldo_disponible <= 0:
        canje_str = voucher.canjeado_at.strftime("%d/%m/%Y %H:%M") if voucher.canjeado_at else ""
        caja_str = f" en {voucher.canjeado_caja_numero}" if voucher.canjeado_caja_numero else ""
        return VoucherCheckResponse(
            id=voucher.id,
            convenio_nombre=voucher.convenio_nombre,
            numero_vale=voucher.numero_vale,
            codigo_barras=voucher.codigo_barras,
            monto_inicial=voucher.monto_inicial,
            saldo_disponible=voucher.saldo_disponible,
            estado=voucher.estado,
            fecha_vencimiento=voucher.fecha_vencimiento,
            es_valido=False,
            mensaje=f"El vale N° {voucher.numero_vale} YA FUE CANJEADO{caja_str} ({canje_str}).",
            beneficiario_nombre=voucher.beneficiario_nombre,
        )

    return VoucherCheckResponse(
        id=voucher.id,
        convenio_nombre=voucher.convenio_nombre,
        numero_vale=voucher.numero_vale,
        codigo_barras=voucher.codigo_barras,
        monto_inicial=voucher.monto_inicial,
        saldo_disponible=voucher.saldo_disponible,
        estado="ACTIVO",
        fecha_vencimiento=voucher.fecha_vencimiento,
        es_valido=True,
        mensaje=f"Vale N° {voucher.numero_vale} ({voucher.convenio_nombre}) VÁLIDO por Gs. {int(voucher.saldo_disponible):,}".replace(",", "."),
        beneficiario_nombre=voucher.beneficiario_nombre,
    )


async def redeem_voucher(
    db: AsyncSession,
    company_id: UUID,
    barcode_or_number: str,
    sale_id: Optional[UUID] = None,
    session_id: Optional[UUID] = None,
    caja_numero: Optional[str] = None,
    usuario_id: Optional[UUID] = None,
    beneficiario_nombre: Optional[str] = None,
) -> VoucherRedeemResponse:
    """Quema de forma atómica y segura el vale de compra para prevenir doble uso."""
    variants = normalize_barcode(barcode_or_number)

    # SELECT FOR UPDATE para asegurar bloqueo transaccional
    stmt = (
        select(InstitutionalVoucher)
        .where(
            InstitutionalVoucher.company_id == company_id,
            or_(
                InstitutionalVoucher.codigo_barras.in_(variants),
                InstitutionalVoucher.numero_vale.in_(variants),
            ),
        )
        .with_for_update()
    )
    res = await db.execute(stmt)
    voucher = res.scalars().first()

    if not voucher:
        raise ValueError(f"El vale '{barcode_or_number}' no existe.")

    if voucher.estado != "ACTIVO" or voucher.saldo_disponible <= 0:
        raise ValueError(f"El vale N° {voucher.numero_vale} ya fue canjeado previamente.")

    today = date.today()
    if voucher.fecha_vencimiento < today:
        raise ValueError(f"El vale N° {voucher.numero_vale} está vencido.")

    monto_a_aplicar = voucher.saldo_disponible
    voucher.estado = "CANJEADO"
    voucher.saldo_disponible = Decimal("0")
    voucher.canjeado_en_sale_id = sale_id
    voucher.canjeado_en_caja_session_id = session_id
    voucher.canjeado_caja_numero = caja_numero
    voucher.canjeado_por_usuario_id = usuario_id
    voucher.canjeado_at = datetime.now(timezone.utc)
    if beneficiario_nombre:
        voucher.beneficiario_nombre = beneficiario_nombre

    await db.flush()

    return VoucherRedeemResponse(
        success=True,
        mensaje=f"Vale N° {voucher.numero_vale} canjeado exitosamente por Gs. {int(monto_a_aplicar):,}".replace(",", "."),
        voucher_id=voucher.id,
        convenio_nombre=voucher.convenio_nombre,
        numero_vale=voucher.numero_vale,
        monto_aplicado=monto_a_aplicar,
        saldo_restante=Decimal("0"),
    )


async def seed_convenio_up(
    db: AsyncSession,
    company_id: UUID,
    total_vales: int = 75,
    monto_por_vale: Decimal = Decimal("100000"),
    fecha_vencimiento: date = date(2026, 12, 31),
    factura_numero: Optional[str] = None,
) -> dict:
    """Siembra inicial idempotente del lote de 75 vales de la Universidad del Pacífico."""
    convenio = "Universidad del Pacífico"
    creados = 0
    existentes = 0

    for i in range(1, total_vales + 1):
        num_str = str(i).zfill(3)  # "001", "002" ... "075"

        # Verificar si ya existe
        stmt = select(InstitutionalVoucher).where(
            InstitutionalVoucher.company_id == company_id,
            InstitutionalVoucher.convenio_nombre == convenio,
            InstitutionalVoucher.numero_vale == num_str,
        )
        res = await db.execute(stmt)
        found = res.scalars().first()

        if found:
            existentes += 1
            continue

        voucher = InstitutionalVoucher(
            company_id=company_id,
            convenio_nombre=convenio,
            cliente_ruc="80024467-2",  # RUC UP
            cliente_razon_social="UNIVERSIDAD DEL PACÍFICO",
            factura_emision_numero=factura_numero,
            numero_vale=num_str,
            codigo_barras=num_str,  # Código de barras correspondiente al número
            monto_inicial=monto_por_vale,
            saldo_disponible=monto_por_vale,
            fecha_vencimiento=fecha_vencimiento,
            estado="ACTIVO",
        )
        db.add(voucher)
        creados += 1

    await db.commit()
    return {
        "convenio": convenio,
        "total_solicitados": total_vales,
        "creados": creados,
        "existentes": existentes,
        "monto_total": float(total_vales * monto_por_vale),
    }


async def get_convenio_summary(
    db: AsyncSession,
    company_id: UUID,
    convenio_nombre: str = "Universidad del Pacífico",
) -> ConvenioSummaryResponse:
    """Obtiene el resumen consolidado y lista de vales para un convenio institucional."""
    stmt = (
        select(InstitutionalVoucher)
        .where(
            InstitutionalVoucher.company_id == company_id,
            InstitutionalVoucher.convenio_nombre == convenio_nombre,
        )
        .order_by(InstitutionalVoucher.numero_vale.asc())
    )
    res = await db.execute(stmt)
    vouchers = res.scalars().all()

    total_emitidos = len(vouchers)
    total_canjeados = sum(1 for v in vouchers if v.estado == "CANJEADO")
    total_activos = sum(1 for v in vouchers if v.estado == "ACTIVO")

    monto_total_emitido = sum(v.monto_inicial for v in vouchers) if vouchers else Decimal("0")
    monto_total_canjeado = sum(v.monto_inicial - v.saldo_disponible for v in vouchers if v.estado == "CANJEADO") if vouchers else Decimal("0")
    monto_saldo_calle = sum(v.saldo_disponible for v in vouchers if v.estado == "ACTIVO") if vouchers else Decimal("0")

    items = [
        VoucherItemSummary(
            id=v.id,
            numero_vale=v.numero_vale,
            codigo_barras=v.codigo_barras,
            monto_inicial=v.monto_inicial,
            saldo_disponible=v.saldo_disponible,
            estado=v.estado,
            canjeado_at=v.canjeado_at,
            canjeado_caja_numero=v.canjeado_caja_numero,
            canjeado_en_sale_id=v.canjeado_en_sale_id,
            beneficiario_nombre=v.beneficiario_nombre,
        )
        for v in vouchers
    ]

    return ConvenioSummaryResponse(
        convenio_nombre=convenio_nombre,
        total_emitidos=total_emitidos,
        total_canjeados=total_canjeados,
        total_activos=total_activos,
        monto_total_emitido=monto_total_emitido,
        monto_total_canjeado=monto_total_canjeado,
        monto_saldo_calle=monto_saldo_calle,
        vales=items,
    )
