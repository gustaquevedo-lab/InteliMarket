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
