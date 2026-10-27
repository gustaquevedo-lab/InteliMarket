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


def _sesion(legacy_caja_id=267575):
    ses = MagicMock()
    ses.id = uuid.uuid4()
    ses.cobrador_id = uuid.uuid4()
    ses.fecha = date(2026, 7, 21)
    ses.estado = "abierta"
    ses.legacy_caja_id = legacy_caja_id
    return ses


def _filas(*filas):
    return MagicMock(fetchall=MagicMock(return_value=list(filas)))


@pytest.mark.asyncio
async def test_close_session_calcula_esperado_con_la_formula():
    """efectivo_esperado = contado + cobros + otros ingresos - devoluciones - depositos - gastos."""
    from api.src.ruta_caja.service import close_session
    db = _mock_db()
    db.get.return_value = _sesion()
    db.execute.side_effect = [_filas(
        ("facturas_contado", 2545086), ("facturas_credito", 900), ("cobro", 50344),
        ("otro_ingreso", 4952), ("deposito", 2600382), ("dev_credito", 10),
    )]
    sid = str(uuid.uuid4())
    await close_session(db, sid, 0, 0, 0, 0, 0, [], closed_by=str(uuid.uuid4()))
    liq_obj = [c[0][0] for c in db.add.call_args_list if hasattr(c[0][0], "efectivo_esperado")][-1]
    assert liq_obj.efectivo_esperado == 0
    assert liq_obj.total_cobrado_ar == 50344


@pytest.mark.asyncio
async def test_close_session_sin_movimientos_espera_cero():
    from api.src.ruta_caja.service import close_session
    db = _mock_db()
    db.get.return_value = _sesion()
    db.execute.side_effect = [_filas()]
    await close_session(db, str(uuid.uuid4()), 30000, 0, 0, 0, 0, [])
    liq_obj = db.add.call_args_list[0][0][0]
    assert liq_obj.efectivo_esperado == 0


@pytest.mark.asyncio
async def test_authorize_faltante_no_lo_aprueba_quien_cerro():
    from api.src.ruta_caja.service import authorize_liquidation
    from fastapi import HTTPException
    db = _mock_db()
    cobrador = str(uuid.uuid4())
    liq = MagicMock(estado="pendiente", efectivo_declarado=900, cheques_declarado=0, efectivo_esperado=1000)
    ses = _sesion()
    ses.closed_by = cobrador
    db.get.side_effect = [liq, ses]
    with pytest.raises(HTTPException) as exc_info:
        await authorize_liquidation(db, str(uuid.uuid4()), supervisor_id=cobrador)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_authorize_faltante_otro_supervisor_si_puede():
    from api.src.ruta_caja.service import authorize_liquidation
    db = _mock_db()
    liq = MagicMock(estado="pendiente", efectivo_declarado=900, cheques_declarado=0, efectivo_esperado=1000)
    ses = _sesion()
    ses.closed_by = str(uuid.uuid4())
    db.get.side_effect = [liq, ses]
    out = await authorize_liquidation(db, str(uuid.uuid4()), supervisor_id=str(uuid.uuid4()))
    assert out.estado == "autorizada"


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
async def test_sesion_propia_usa_cobros_de_ar_con_zona_asuncion():
    """Una sesion sin caja legacy toma los cobros en efectivo de AR del dia, en America/Asuncion."""
    from api.src.ruta_caja import service
    db = _mock_db()
    db.get.return_value = _sesion(legacy_caja_id=None)
    db.execute.side_effect = [_filas(), MagicMock(scalar=MagicMock(return_value=120000))]
    await service.close_session(db, str(uuid.uuid4()), 0, 0, 0, 0, 0, [])
    assert "AT TIME ZONE" in str(db.execute.call_args_list[1][0][0])
    liq_obj = db.add.call_args_list[0][0][0]
    assert liq_obj.efectivo_esperado == 120000
