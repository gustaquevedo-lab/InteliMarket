"""Panel Revision de cobros: listados, marcar revisado y permiso."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from api.src.caja import revision_cobros as rc
from api.src.pos_terminal_transactions.models import PosTerminalTransaction
from api.src.sales.models import Sale, SalePayment

AHORA = datetime(2026, 10, 10, 12, 0, tzinfo=timezone.utc)
CO = uuid4()


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        for t in (Sale.__table__, SalePayment.__table__, PosTerminalTransaction.__table__):
            await conn.run_sync(lambda c, t=t: t.create(c))
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session
    await engine.dispose()



async def _venta(db, **campos):
    from sqlalchemy import Numeric, String, Boolean, DateTime
    vals = {"id": uuid4(), "company_id": CO}
    for col in Sale.__table__.columns:
        if col.name in campos or col.name in vals:
            continue
        if col.nullable or col.default is not None or col.server_default is not None:
            continue
        t = col.type
        if isinstance(t, Numeric):
            vals[col.name] = Decimal("0")
        elif isinstance(t, Boolean):
            vals[col.name] = False
        elif isinstance(t, DateTime):
            vals[col.name] = AHORA
        else:
            vals[col.name] = "x" + uuid4().hex[:10]
    vals.update(campos)
    db.add(Sale(**vals))
    await db.flush()
    return vals["id"]


async def _pago(db, sale_id, proveedor):
    db.add(SalePayment(
        id=uuid4(), company_id=CO, sale_id=sale_id, forma_pago="TARJETA",
        monto=Decimal("1000"), fecha=AHORA, proveedor=proveedor,
    ))
    await db.flush()


async def _cobro(db, minutos, **campos):
    cid = uuid4()
    base = dict(id=cid, company_id=CO, tipo_operacion="venta_debito", exitosa=True,
                created_at=AHORA - timedelta(minutes=minutos))
    base.update(campos)
    db.add(PosTerminalTransaction(**base))
    await db.flush()
    return cid


async def test_no_cuadran_lista_y_excluye_revisadas(db):
    a = await _venta(db, pagos_revision="no_cuadran", pagos_diferencia=Decimal("500"), total=Decimal("9000"))
    await _venta(db, pagos_revision="no_cuadran", pagos_revisado_at=AHORA)
    await _venta(db, pagos_revision="no_verificable")
    await _venta(db, pagos_revision=None)
    items = await rc.listar_revision(db, CO, "no_cuadran", ahora=AHORA)
    assert [i["id"] for i in items] == [a]
    assert set(items[0]) >= {"id", "numero", "fecha", "total", "pagos_revision", "pagos_diferencia"}


async def test_huerfanos_regla_15_minutos_o_requiere_conciliacion(db):
    viejo = await _cobro(db, 20)
    await _cobro(db, 5)
    conc = await _cobro(db, 1, exitosa=False, requiere_conciliacion=True)
    await _cobro(db, 20, sale_id=uuid4())
    await _cobro(db, 20, revisado_at=AHORA)
    items = await rc.listar_revision(db, CO, "huerfanos", ahora=AHORA)
    assert {i["id"] for i in items} == {viejo, conc}
    assert set(items[0]) >= {"id", "fecha", "tipo_operacion", "monto", "punto_emision", "exitosa",
                             "requiere_conciliacion", "nombre_tarjeta", "codigo_autorizacion"}


async def test_multi_proveedor_solo_con_dos_proveedores_distintos(db):
    mixta = await _venta(db)
    await _pago(db, mixta, "bancard")
    await _pago(db, mixta, "dinelco")
    igual = await _venta(db)
    await _pago(db, igual, "bancard")
    await _pago(db, igual, "bancard")
    revisada = await _venta(db, pagos_revisado_at=AHORA)
    await _pago(db, revisada, "bancard")
    await _pago(db, revisada, "dinelco")
    items = await rc.listar_revision(db, CO, "multi_proveedor", ahora=AHORA)
    assert [i["id"] for i in items] == [mixta]
    assert sorted(items[0]["proveedores"]) == ["bancard", "dinelco"]


async def test_tipo_invalido(db):
    with pytest.raises(ValueError):
        await rc.listar_revision(db, CO, "otro")


async def test_marcar_revisado_registra_auditoria(db, monkeypatch):
    llamadas = []

    async def falso(_db, data):
        llamadas.append(data)
        return {}

    monkeypatch.setattr(rc, "record_audit_event", falso)
    cid = await _cobro(db, 20)
    user = {"id": str(uuid4()), "company_id": str(CO)}
    assert await rc.marcar_revisado(db, CO, "huerfanos", cid, user) is True
    assert llamadas[0]["accion"] == "cobro_revisado"
    assert llamadas[0]["user_id"] == user["id"]
    assert llamadas[0]["entidad_id"] == cid
    assert await rc.listar_revision(db, CO, "huerfanos", ahora=AHORA) == []

    vid = await _venta(db, pagos_revision="no_cuadran")
    assert await rc.marcar_revisado(db, CO, "no_cuadran", vid, user) is True
    assert llamadas[1]["entidad"] == "venta"
    assert await rc.listar_revision(db, CO, "no_cuadran", ahora=AHORA) == []
    assert await rc.marcar_revisado(db, CO, "no_cuadran", uuid4(), user) is False


async def test_endpoints_exigen_el_permiso(db, monkeypatch):
    from httpx import ASGITransport, AsyncClient
    from api.src.auth.middleware import require_auth
    from api.src.db import get_db
    from api.src.main import app

    monkeypatch.setattr(rc, "record_audit_event", lambda *a, **k: _async_none())
    user = {"id": str(uuid4()), "tenant_id": str(uuid4()), "company_id": str(CO), "is_superadmin": False}
    app.dependency_overrides[require_auth] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    permitido = {"v": False}

    async def check(*a, **k):
        return permitido["v"]

    monkeypatch.setattr("api.src.rbac.deps.service.check_permission", check)
    cid = await _cobro(db, 20)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            r = await c.get("/api/v1/caja/revision-cobros", params={"tipo": "huerfanos"})
            assert r.status_code == 403
            r = await c.post(f"/api/v1/caja/revision-cobros/huerfanos/{cid}/revisar")
            assert r.status_code == 403
            permitido["v"] = True
            r = await c.get("/api/v1/caja/revision-cobros", params={"tipo": "huerfanos"})
            assert r.status_code == 200
            assert [i["id"] for i in r.json()] == [str(cid)]
            r = await c.post(f"/api/v1/caja/revision-cobros/huerfanos/{cid}/revisar")
            assert r.status_code == 200
    finally:
        app.dependency_overrides.clear()


async def _async_none():
    return {}
