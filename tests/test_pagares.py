"""Tests for pagares module — TDD first pass"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
import uuid
from datetime import date


COMPANY_ID = str(uuid.uuid4())
CUSTOMER_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())


@pytest.mark.asyncio
async def test_create_pagare_sets_saldo_equal_to_monto():
    """saldo_pendiente must equal monto_original on creation."""
    from api.src.pagares.schemas import PagareCreate
    from api.src.pagares.models import Pagare

    mock_db = AsyncMock()
    created_pagare = None

    def capture_add(obj):
        nonlocal created_pagare
        created_pagare = obj

    mock_db.add = MagicMock(side_effect=capture_add)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    from api.src.pagares.service import PagareService
    svc = PagareService(mock_db)
    data = PagareCreate(
        company_id=COMPANY_ID,
        customer_id=CUSTOMER_ID,
        numero_pagare="P-001",
        monto_original=Decimal("1000000"),
        fecha_emision=date.today(),
        fecha_vencimiento=date.today(),
    )
    await svc.create(data, created_by=USER_ID)
    assert created_pagare is not None
    assert created_pagare.saldo_pendiente == Decimal("1000000")
    assert created_pagare.estado == "vigente"


@pytest.mark.asyncio
async def test_pay_pagare_excess_raises_422():
    """Paying more than saldo_pendiente must raise HTTP 422."""
    from api.src.pagares.service import PagareService
    from api.src.pagares.schemas import PagarePayInput
    from api.src.pagares.models import Pagare
    from fastapi import HTTPException

    mock_db = AsyncMock()
    p = Pagare()
    p.id = uuid.uuid4()
    p.monto_original = Decimal("500000")
    p.saldo_pendiente = Decimal("200000")
    p.estado = "vigente"

    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=p)
    mock_db.execute = AsyncMock(return_value=mock_result)

    svc = PagareService(mock_db)
    with pytest.raises(HTTPException) as exc_info:
        await svc.pay(
            p.id,
            PagarePayInput(monto=Decimal("999999"), fecha=date.today()),
            created_by=USER_ID,
        )
    assert exc_info.value.status_code == 422
