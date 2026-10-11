"""Tests de pago mixto (Etapa 1): esquemas y columnas nuevas."""

from decimal import Decimal
from uuid import uuid4

import pytest
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
