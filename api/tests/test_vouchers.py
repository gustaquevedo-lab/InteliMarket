"""Tests for Institutional Vouchers (Vales Institucionales / Convenio Universidad del Pacífico)"""

from datetime import date
from decimal import Decimal
import uuid
import pytest

from api.src.vouchers.service import (
    normalize_barcode,
    seed_convenio_up,
    check_voucher,
    redeem_voucher,
    get_convenio_summary,
)


def test_normalize_barcode():
    # Caso 1: Solo dígitos
    res = normalize_barcode("001")
    assert "001" in res
    assert "VALE-001" in res
    assert "VALE 001" in res

    # Caso 2: Prefijo con espacio
    res2 = normalize_barcode("VALE 002")
    assert "002" in res2
    assert "VALE-002" in res2

    # Caso 3: Texto de ticket impreso
    res3 = normalize_barcode("VALE N.º 075")
    assert "075" in res3
    assert "VALE-075" in res3


@pytest.mark.asyncio
async def test_vouchers_lifecycle(db_session):
    company_id = uuid.uuid4()

    # 1. Siembra del lote de 75 vales para Universidad del Pacífico
    seed_res = await seed_convenio_up(
        db=db_session,
        company_id=company_id,
        total_vales=75,
        monto_por_vale=Decimal("100000"),
        fecha_vencimiento=date(2026, 12, 31),
        factura_numero="001-002-0001234",
    )
    assert seed_res["creados"] == 75
    assert seed_res["monto_total"] == 7500000.0

    # 2. Re-ejecución idempotente: no debe crear duplicados
    seed_res2 = await seed_convenio_up(db=db_session, company_id=company_id, total_vales=75)
    assert seed_res2["creados"] == 0
    assert seed_res2["existentes"] == 75

    # 3. Consulta de vale por código de barras "001"
    chk1 = await check_voucher(db_session, company_id, "001")
    assert chk1.es_valido is True
    assert chk1.estado == "ACTIVO"
    assert chk1.saldo_disponible == Decimal("100000")
    assert chk1.convenio_nombre == "Universidad del Pacífico"

    # 4. Consulta por variante con texto "VALE N.º 001"
    chk_variant = await check_voucher(db_session, company_id, "VALE N.º 001")
    assert chk_variant.es_valido is True
    assert chk_variant.numero_vale == "001"

    # 5. Canje exitoso en caja
    sale_id = uuid.uuid4()
    session_id = uuid.uuid4()
    user_id = uuid.uuid4()

    redeem_res = await redeem_voucher(
        db=db_session,
        company_id=company_id,
        barcode_or_number="001",
        sale_id=sale_id,
        session_id=session_id,
        caja_numero="CAJA-02",
        usuario_id=user_id,
        beneficiario_nombre="Prof. Carlos Benítez",
    )
    assert redeem_res.success is True
    assert redeem_res.monto_aplicado == Decimal("100000")
    assert redeem_res.saldo_restante == Decimal("0")

    # 6. Intentar canjear el mismo vale de nuevo (debe fallar)
    with pytest.raises(ValueError, match="ya fue canjeado"):
        await redeem_voucher(
            db=db_session,
            company_id=company_id,
            barcode_or_number="001",
        )

    # 7. Consulta del vale canjeado (debe reportar CANJEADO con fecha y caja)
    chk_canjeado = await check_voucher(db_session, company_id, "001")
    assert chk_canjeado.es_valido is False
    assert chk_canjeado.estado == "CANJEADO"
    assert "YA FUE CANJEADO" in chk_canjeado.mensaje

    # 8. Consulta de vale inexistente
    chk_inexistente = await check_voucher(db_session, company_id, "999")
    assert chk_inexistente.es_valido is False
    assert chk_inexistente.estado == "NO_EXISTE"

    # 9. Resumen consolidado para la Universidad del Pacífico
    summary = await get_convenio_summary(db_session, company_id, "Universidad del Pacífico")
    assert summary.total_emitidos == 75
    assert summary.total_canjeados == 1
    assert summary.total_activos == 74
    assert summary.monto_total_emitido == Decimal("7500000")
    assert summary.monto_total_canjeado == Decimal("100000")
    assert summary.monto_saldo_calle == Decimal("7400000")
