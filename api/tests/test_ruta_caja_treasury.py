from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
import pytest
from datetime import date


def _mock_db():
    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_treasury_daily_summary_aggregates_authorized():
    """get_treasury_daily_summary sums only autorizada liquidations."""
    from api.src.ruta_caja.service import get_treasury_daily_summary
    import uuid
    db = _mock_db()

    # Row: (id, efectivo_declarado, cheques_declarado, pagares_declarado, cobrador_id)
    liq_row = (str(uuid.uuid4()), 200000, 100000, 50000, str(uuid.uuid4()))
    retail_row = (0, 0)

    db.execute.side_effect = [
        MagicMock(fetchall=MagicMock(return_value=[liq_row])),   # rutas query
        MagicMock(fetchone=MagicMock(return_value=retail_row)),   # retail query
    ]
    result = await get_treasury_daily_summary(
        db, "00000000-0000-0000-0000-000000000010", date.today()
    )
    assert result["totales"]["total_efectivo"] == 200000
    assert result["totales"]["total_cheques"] == 100000
    assert len(result["rutas"]) == 1


@pytest.mark.asyncio
async def test_bank_deposit_partial_liquidations():
    """create_bank_deposit accepts a subset of authorized liquidations (not all required)."""
    from api.src.ruta_caja.service import create_bank_deposit
    from api.src.ruta_caja.schemas import BankDepositCreate
    import uuid
    db = _mock_db()
    data = BankDepositCreate(
        company_id="00000000-0000-0000-0000-000000000010",
        fecha=date.today(),
        bank_name="Banco Continental",
        account_number="001-001-001",
        monto_efectivo=150000,
        monto_cheques=0,
        route_liquidation_ids=[str(uuid.uuid4())],
        cash_session_ids=[],
        created_by=str(uuid.uuid4()),
    )
    await create_bank_deposit(db, data)
    db.add.assert_called_once()
    deposited = db.add.call_args[0][0]
    assert deposited.monto_efectivo == 150000
    assert len(deposited.route_liquidation_ids) == 1
