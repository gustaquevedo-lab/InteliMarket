import pytest
from uuid import uuid4
from decimal import Decimal
from api.src.accounts_receivable.schemas import ReceivablePaymentCreate, ReceivableAllocationInput


def test_ar_payment_create_with_requisition_fields():
    alloc = ReceivableAllocationInput(
        accounts_receivable_id=uuid4(),
        monto=Decimal("50000"),
    )
    req_id = uuid4()
    payment_data = ReceivablePaymentCreate(
        customer_id=uuid4(),
        monto_total=Decimal("50000"),
        forma_pago="compensacion_interna",
        requisicion_id=req_id,
        production_area="panaderia",
        allocations=[alloc],
    )

    assert payment_data.forma_pago == "compensacion_interna"
    assert payment_data.requisicion_id == req_id
    assert payment_data.production_area == "panaderia"
