from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
import pytest
from datetime import date
import uuid


def _mock_db():
    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock()
    db.get = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_open_session_sets_fondo_inicial():
    """open_route_session creates RouteSession with correct fondo_inicial."""
    from api.src.ruta_caja.service import open_route_session
    db = _mock_db()
    db.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)
    session = await open_route_session(
        db,
        company_id="00000000-0000-0000-0000-000000000010",
        cobrador_id=str(uuid.uuid4()),
        route_id=None,
        fecha=date.today(),
        fondo_inicial=50000,
        created_by=str(uuid.uuid4()),
    )
    db.add.assert_called_once()
    added = db.add.call_args[0][0]
    assert added.fondo_inicial == 50000
    assert added.estado == "abierta"


@pytest.mark.asyncio
async def test_open_session_duplicate_returns_409():
    """open_route_session raises HTTPException 409 if session already exists today."""
    from api.src.ruta_caja.service import open_route_session
    from fastapi import HTTPException
    from api.src.ruta_caja.models import RouteSession
    db = _mock_db()
    existing = MagicMock(spec=RouteSession)
    existing.fecha = date.today()
    db.execute.return_value.scalar_one_or_none = MagicMock(return_value=existing)
    with pytest.raises(HTTPException) as exc_info:
        await open_route_session(
            db, "cid", str(uuid.uuid4()), None, date.today(), 0, str(uuid.uuid4())
        )
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_close_session_calculates_efectivo_esperado_from_ar():
    """close_session sums receivable_payments of tipo='efectivo' for cobrador on fecha."""
    from api.src.ruta_caja.service import close_session
    db = _mock_db()
    session_id = str(uuid.uuid4())
    cobrador_id = str(uuid.uuid4())
    mock_session = MagicMock()
    mock_session.id = session_id
    mock_session.cobrador_id = cobrador_id
    mock_session.fecha = date.today()
    mock_session.estado = "abierta"
    db.get.return_value = mock_session
    db.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=120000)),  # efectivo_esperado
        MagicMock(scalar=MagicMock(return_value=180000)),  # total_cobrado_ar
    ]
    await close_session(
        db, session_id=session_id,
        efectivo_declarado=115000,
        cheques_declarado=50000,
        pagares_declarado=15000,
        nc_aplicadas=0,
        descuentos_autorizados=0,
        items=[],
    )
    db.add.assert_called()
    liq_obj = db.add.call_args_list[-1][0][0]
    assert liq_obj.efectivo_esperado == 120000


@pytest.mark.asyncio
async def test_close_session_zero_ar_payments():
    """efectivo_esperado is 0 (not error) when cobrador has no AR payments today."""
    from api.src.ruta_caja.service import close_session
    db = _mock_db()
    mock_session = MagicMock()
    mock_session.estado = "abierta"
    mock_session.fecha = date.today()
    mock_session.cobrador_id = str(uuid.uuid4())
    db.get.return_value = mock_session
    db.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=None)),  # None → treat as 0
        MagicMock(scalar=MagicMock(return_value=None)),  # total also None
    ]
    await close_session(
        db, str(uuid.uuid4()), 30000, 0, 0, 0, 0, []
    )
    liq_obj = db.add.call_args_list[-1][0][0]
    assert liq_obj.efectivo_esperado == 0


@pytest.mark.asyncio
async def test_authorize_already_authorized_returns_409():
    """authorize_liquidation raises 409 if estado != 'pendiente'."""
    from api.src.ruta_caja.service import authorize_liquidation
    from fastapi import HTTPException
    db = _mock_db()
    liq = MagicMock()
    liq.estado = "autorizada"
    db.get.return_value = liq
    with pytest.raises(HTTPException) as exc_info:
        await authorize_liquidation(db, str(uuid.uuid4()), supervisor_id=str(uuid.uuid4()))
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_close_session_timezone_boundary():
    """AR query filter uses DATE AT TIME ZONE 'America/Asuncion'."""
    from api.src.ruta_caja import service
    db = _mock_db()
    mock_session = MagicMock()
    mock_session.estado = "abierta"
    mock_session.fecha = date(2026, 10, 14)
    mock_session.cobrador_id = str(uuid.uuid4())
    db.get.return_value = mock_session
    db.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=0)),
        MagicMock(scalar=MagicMock(return_value=0)),
    ]
    await service.close_session(db, str(uuid.uuid4()), 0, 0, 0, 0, 0, [])
    first_call_sql = str(db.execute.call_args_list[0][0][0])
    assert "America/Asuncion" in first_call_sql or "AT TIME ZONE" in first_call_sql
