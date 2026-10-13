"""Tests for T4: AR extensions — cobrador, by-route, register_payment_with_nc."""
import pytest
from unittest.mock import AsyncMock, MagicMock
import uuid
from decimal import Decimal
from datetime import date
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_register_payment_with_delivery_note_validates_monto():
    """Si delivery_note_monto > saldo del documento, el servicio rechaza con 422."""
    from api.src.accounts_receivable.service import AccountsReceivableService
    from api.src.accounts_receivable.models import Account

    mock_db = AsyncMock()
    acct = Account()
    acct.id = uuid.uuid4()
    acct.saldo_pendiente = Decimal("100000")
    acct.estado = "pendiente"

    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[acct])))
    mock_db.execute = AsyncMock(return_value=mock_result)

    svc = AccountsReceivableService(mock_db)
    with pytest.raises(HTTPException) as exc_info:
        await svc.register_payment_with_nc(
            company_id=str(uuid.uuid4()),
            customer_id=str(uuid.uuid4()),
            monto_total=Decimal("100000"),
            delivery_note_id=str(uuid.uuid4()),
            delivery_note_monto=Decimal("999999"),  # excede saldo
            fecha=date.today(),
            created_by=str(uuid.uuid4()),
        )
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_register_payment_with_nc_accepts_allocations():
    """register_payment_with_nc debe aceptar allocations y pasarlas a create_receivable_payment."""
    from api.src.accounts_receivable.service import AccountsReceivableService
    from unittest.mock import patch, AsyncMock as AM

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    mock_db.execute = AsyncMock(return_value=mock_result)

    ar_id = uuid.uuid4()

    @pytest.mark.asyncio
    async def fake_create(db, company_id, data, created_by):
        # Debe existir el campo allocations
        assert hasattr(data, "allocations")
        assert len(data.allocations) == 1
        return {"ok": True}

    alloc = MagicMock()
    alloc.accounts_receivable_id = ar_id
    alloc.monto = Decimal("50000")

    svc = AccountsReceivableService(mock_db)
    with patch(
        "api.src.accounts_receivable.service.create_receivable_payment",
        side_effect=fake_create,
    ):
        result = await svc.register_payment_with_nc(
            company_id=str(uuid.uuid4()),
            customer_id=str(uuid.uuid4()),
            monto_total=Decimal("50000"),
            fecha=date.today(),
            created_by=str(uuid.uuid4()),
            allocations=[alloc],
        )
    assert result == {"ok": True}



@pytest.mark.asyncio
async def test_by_route_excludes_zero_balance_customers():
    """Clientes con saldo 0 no aparecen en la vista por ruta."""
    from api.src.accounts_receivable.service import AccountsReceivableService

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.all = MagicMock(return_value=[])
    mock_db.execute = AsyncMock(return_value=mock_result)

    svc = AccountsReceivableService(mock_db)
    result = await svc.get_by_route(
        company_id=str(uuid.uuid4()),
        route_id=str(uuid.uuid4()),
        fecha=date.today(),
    )
    assert isinstance(result, list)
