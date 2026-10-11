"""Tests de pago mixto (Etapa 1): esquemas y columnas nuevas."""

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
import pytest_asyncio
from pydantic import ValidationError

from api.src.pos_terminal_transactions.models import PosTerminalTransaction
from api.src.pos_terminal_transactions.schemas import (
    PosTerminalTransactionCreate,
    PosTerminalTransactionResponse,
)
from api.src.sales.models import Sale, SalePayment
from api.src.sales.schemas import SalePaymentInput
from api.src.sales.pagos_revision import (
    LineaPago,
    evaluar_pagos,
    forma_pago_resumen,
    marca_prevalente,
    registrar_pagos_de_venta,
    vincular_cobros_terminal,
)


class TestEsquemas:
    def test_payload_viejo_sigue_valido(self):
        p = SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("1000"))
        assert p.proveedor is None and p.terminal_transaction_id is None and p.monto_pyg is None

    def test_payload_nuevo_acepta_campos_opcionales(self):
        tid = uuid4()
        p = SalePaymentInput(
            forma_pago="TARJETA CREDITO", monto=Decimal("5000"), proveedor="bancard",
            terminal_transaction_id=tid, referencia="123456", cuotas=3, monto_pyg=Decimal("5000"),
        )
        assert (p.proveedor, p.terminal_transaction_id, p.cuotas) == ("bancard", tid, 3)

    def test_monto_debe_ser_positivo(self):
        with pytest.raises(ValidationError):
            SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("0"))

    def test_modelos_tienen_las_columnas_nuevas(self):
        for col in ("proveedor", "terminal_transaction_id", "referencia", "cuotas", "monto_pyg"):
            assert hasattr(SalePayment, col)
        for col in ("pagos_revision", "pagos_diferencia", "pagos_revisado_por", "pagos_revisado_at"):
            assert hasattr(Sale, col)
        for col in ("requiere_conciliacion", "revisado_por", "revisado_at"):
            assert hasattr(PosTerminalTransaction, col)

    def test_esquemas_terminal(self):
        c = PosTerminalTransactionCreate(tipo_operacion="venta_credito")
        assert c.requiere_conciliacion is False
        assert "requiere_conciliacion" in PosTerminalTransactionResponse.model_fields
        assert "sale_id" in PosTerminalTransactionResponse.model_fields


D = Decimal


def L(forma, monto, moneda="PYG", monto_pyg=None):
    return LineaPago(forma_pago=forma, monto=D(monto), moneda=moneda, monto_pyg=monto_pyg)


class TestEvaluarPagos:
    def test_suma_exacta_no_marca(self):
        assert evaluar_pagos(D(100000), [L("EFECTIVO", 60000), L("TARJETA DEBITO", 40000)]) == (None, None)

    def test_diferencia_de_mas(self):
        assert evaluar_pagos(D(100000), [L("EFECTIVO", 100500)]) == ("no_cuadran", D(500))

    def test_diferencia_de_menos(self):
        assert evaluar_pagos(D(100000), [L("EFECTIVO", 99000)]) == ("no_cuadran", D(-1000))

    def test_borde_tolerancia(self):
        assert evaluar_pagos(D(100000), [L("QR", 100050)]) == (None, None)
        assert evaluar_pagos(D(100000), [L("QR", 100051)]) == ("no_cuadran", D(51))

    def test_sin_lineas_no_valida(self):
        assert evaluar_pagos(D(100000), []) == (None, None)

    def test_linea_extranjera_sin_monto_pyg(self):
        assert evaluar_pagos(D(200000), [L("EFECTIVO", D("20.00"), "BRL"), L("EFECTIVO", 50000)]) == ("no_verificable", None)

    def test_linea_extranjera_con_monto_pyg(self):
        assert evaluar_pagos(D(200000), [L("EFECTIVO", D("20.00"), "BRL", D(148000)), L("EFECTIVO", 52000)]) == (None, None)

    def test_prevalencia_de_marcas(self):
        assert marca_prevalente(None, "no_verificable", "no_cuadran") == "no_cuadran"
        assert marca_prevalente("enlace_invalido", "no_cuadran") == "enlace_invalido"
        assert marca_prevalente(None, None) is None

    def test_forma_pago_resumen(self):
        assert forma_pago_resumen([], "contado") == "EFECTIVO"
        assert forma_pago_resumen([], "credito") == "EXTRA_CLUB"
        assert forma_pago_resumen(["QR"], "contado") == "QR"
        assert forma_pago_resumen(["EFECTIVO", "QR"], "contado") == "MIXTO"
        assert forma_pago_resumen(["QR", "QR"], "contado") == "QR"
        assert forma_pago_resumen(["efectivo", "EFECTIVO"], "contado") == "EFECTIVO"


# ---------------------------------------------------------------------------
# Enlace de cobros y registro de lineas (SQLite en memoria)
# ---------------------------------------------------------------------------
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

AHORA = datetime(2026, 10, 10, tzinfo=timezone.utc)


@pytest_asyncio.fixture
async def sqlite_db():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: PosTerminalTransaction.__table__.create(c))
        await conn.run_sync(lambda c: SalePayment.__table__.create(c))
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session
    await engine.dispose()


async def _cobro(db, company_id, sale_id=None):
    tid = uuid4()
    db.add(PosTerminalTransaction(
        id=tid, company_id=company_id, sale_id=sale_id, tipo_operacion="venta_debito",
    ))
    await db.flush()
    return tid


async def _sale_id_de(db, tid):
    res = await db.execute(
        select(PosTerminalTransaction.sale_id).where(PosTerminalTransaction.id == tid)
    )
    return res.scalar_one()


class TestVincularCobros:
    async def test_vincula_cobro_libre(self, sqlite_db):
        co, sale = uuid4(), uuid4()
        tid = await _cobro(sqlite_db, co)
        assert await vincular_cobros_terminal(sqlite_db, co, sale, [tid]) == []
        assert await _sale_id_de(sqlite_db, tid) == sale

    async def test_cobro_de_otra_empresa_no_se_vincula(self, sqlite_db):
        tid = await _cobro(sqlite_db, uuid4())
        assert await vincular_cobros_terminal(sqlite_db, uuid4(), uuid4(), [tid]) == [tid]
        assert await _sale_id_de(sqlite_db, tid) is None

    async def test_cobro_ya_enlazado_a_otra_venta_no_se_pisa(self, sqlite_db):
        co, otra = uuid4(), uuid4()
        tid = await _cobro(sqlite_db, co, sale_id=otra)
        assert await vincular_cobros_terminal(sqlite_db, co, uuid4(), [tid]) == [tid]
        assert await _sale_id_de(sqlite_db, tid) == otra

    async def test_id_inexistente_se_reporta(self, sqlite_db):
        ghost = uuid4()
        assert await vincular_cobros_terminal(sqlite_db, uuid4(), uuid4(), [ghost]) == [ghost]

    async def test_mismo_id_en_dos_lineas_es_idempotente(self, sqlite_db):
        co = uuid4()
        tid = await _cobro(sqlite_db, co)
        assert await vincular_cobros_terminal(sqlite_db, co, uuid4(), [tid, tid]) == []


def _sale(total):
    return SimpleNamespace(id=uuid4(), total=Decimal(total), pagos_revision=None, pagos_diferencia=None)


async def _lineas(db, sale):
    res = await db.execute(select(SalePayment).where(SalePayment.sale_id == sale.id))
    return res.scalars().all()


class TestRegistrarPagos:
    async def test_registra_lineas_con_campos_nuevos(self, sqlite_db):
        co, sale = uuid4(), _sale(100000)
        pagos = [
            SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("60000")),
            SalePaymentInput(forma_pago="TARJETA DEBITO", monto=Decimal("40000"), proveedor="bancard",
                             referencia="ABC", cuotas=1, monto_pyg=Decimal("40000")),
        ]
        await registrar_pagos_de_venta(sqlite_db, company_id=co, sale=sale, pagos=pagos, ahora=AHORA)
        filas = await _lineas(sqlite_db, sale)
        assert len(filas) == 2
        tarjeta = next(f for f in filas if f.forma_pago == "TARJETA DEBITO")
        assert (tarjeta.proveedor, tarjeta.referencia, tarjeta.cuotas, tarjeta.monto_pyg) == (
            "bancard", "ABC", 1, Decimal("40000"))
        assert sale.pagos_revision is None

    async def test_payload_viejo_crea_lineas_como_antes(self, sqlite_db):
        sale = _sale(1000)
        await registrar_pagos_de_venta(
            sqlite_db, company_id=uuid4(), sale=sale,
            pagos=[SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("1000"))], ahora=AHORA)
        (f,) = await _lineas(sqlite_db, sale)
        assert (f.proveedor, f.terminal_transaction_id, f.referencia, f.cuotas, f.monto_pyg) == (
            None, None, None, None, None)
        assert sale.pagos_revision is None

    async def test_linea_brl_sin_monto_pyg_marca_no_verificable(self, sqlite_db):
        sale = _sale(200000)
        pagos = [SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("20"), moneda="brl"),
                 SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("50000"))]
        await registrar_pagos_de_venta(sqlite_db, company_id=uuid4(), sale=sale, pagos=pagos, ahora=AHORA)
        assert sale.pagos_revision == "no_verificable"
        assert sale.pagos_diferencia is None

    async def test_enlace_ajeno_guarda_y_marca_enlace_invalido(self, sqlite_db):
        tid = await _cobro(sqlite_db, uuid4())  # de otra empresa
        sale = _sale(1000)
        pagos = [SalePaymentInput(forma_pago="QR", monto=Decimal("1000"), terminal_transaction_id=tid)]
        await registrar_pagos_de_venta(sqlite_db, company_id=uuid4(), sale=sale, pagos=pagos, ahora=AHORA)
        assert len(await _lineas(sqlite_db, sale)) == 1
        assert sale.pagos_revision == "enlace_invalido"

    async def test_sanea_referencia_proveedor_y_cuotas(self, sqlite_db):
        sale = _sale(1000)
        pagos = [SalePaymentInput(forma_pago="TARJETA CREDITO", monto=Decimal("1000"),
                                  proveedor="p" * 50, referencia="r" * 100, cuotas=99999)]
        await registrar_pagos_de_venta(sqlite_db, company_id=uuid4(), sale=sale, pagos=pagos, ahora=AHORA)
        (f,) = await _lineas(sqlite_db, sale)
        assert len(f.referencia) == 60 and len(f.proveedor) == 20 and f.cuotas is None

    async def test_sanea_moneda_y_forma_pago_largas(self, sqlite_db):
        sale = _sale(1000)
        pagos = [SalePaymentInput(forma_pago="F" * 80, monto=Decimal("1000"), moneda=" pygxyz ")]
        await registrar_pagos_de_venta(sqlite_db, company_id=uuid4(), sale=sale, pagos=pagos, ahora=AHORA)
        (f,) = await _lineas(sqlite_db, sale)
        assert len(f.forma_pago) == 30 and f.moneda == "PYG"

    async def test_sanea_monto_pyg_fuera_de_rango_o_negativo(self, sqlite_db):
        sale = _sale(3000)
        pagos = [
            SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("1000"), monto_pyg=Decimal("1e15")),
            SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("1000"), monto_pyg=Decimal("-5")),
            SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("1000"), monto_pyg=Decimal("1000")),
        ]
        await registrar_pagos_de_venta(sqlite_db, company_id=uuid4(), sale=sale, pagos=pagos, ahora=AHORA)
        filas = await _lineas(sqlite_db, sale)
        assert sorted(str(f.monto_pyg) for f in filas) == ["1000", "None", "None"]
        # lineas PYG sin monto_pyg valido usan el monto: la venta cuadra
        assert sale.pagos_revision is None

    async def test_monto_pyg_invalido_en_moneda_extranjera_queda_no_verificable(self, sqlite_db):
        sale = _sale(100000)
        pagos = [SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("20"), moneda="USD",
                                  monto_pyg=Decimal("-100000"))]
        await registrar_pagos_de_venta(sqlite_db, company_id=uuid4(), sale=sale, pagos=pagos, ahora=AHORA)
        (f,) = await _lineas(sqlite_db, sale)
        assert f.monto_pyg is None
        assert sale.pagos_revision == "no_verificable"

    async def test_monto_fuera_de_rango_no_rompe_y_marca_no_cuadran(self, sqlite_db):
        sale = _sale(1000)
        pagos = [SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("1e14"))]
        await registrar_pagos_de_venta(sqlite_db, company_id=uuid4(), sale=sale, pagos=pagos, ahora=AHORA)
        (f,) = await _lineas(sqlite_db, sale)
        assert f.monto == Decimal("0")
        assert sale.pagos_revision == "no_cuadran"
