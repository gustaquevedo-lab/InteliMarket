# Caja de Ruta y Tesorería — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full cobrador daily settlement cycle — supervisor opens session, cobrador declares at return, supervisor reconciles against AR, tesorero consolidates and registers bank deposit.

**Architecture:** New `api/src/ruta_caja/` module (independent of the retail `caja` module). Four new tables. Router mounted at `/api/v1/distribuidora/`. Three new frontend pages under `ui-web/src/pages/distribuidora/`, registered in App.tsx.

**Tech Stack:** FastAPI + SQLAlchemy async + PostgreSQL; React 18 + TypeScript + Vite; Alembic for migrations; pytest-asyncio + MagicMock for backend tests.

**Spec:** `docs/superpowers/specs/2026-10-14-caja-ruta-tesoreria-design.md`

## Global Constraints

- Python: follow `from __future__ import annotations` pattern used in accounts_receivable.
- SQLAlchemy: use `Column(UUID(as_uuid=True), server_default=func.gen_random_uuid())` pattern.
- Numeric columns: `Numeric(18, 0)` for currency (Guaraníes, no decimals).
- Router prefix: `/api/v1/distribuidora` — new endpoints are added to the existing prefix (new router file, registered in main.py).
- Auth: endpoints use `require_auth` from `api.src.auth.middleware`; `current_user` dict has `sub` (UUID string) and `company_id`.
- Migration ID: `20261014120000`; `down_revision = "20261013110000"`.
- TypeScript: new API methods go inside `api.distribuidora` object in `ui-web/src/api/index.ts`; types declared in same file.
- Company ID for Casa Gonzalito: `00000000-0000-0000-0000-000000000010`.
- No new environment variables (Settings has `extra='forbid'`).
- Estado values for route_sessions: exactly `abierta`, `cerrada`, `liquidada`, `observada`.
- Estado values for route_liquidations: exactly `pendiente`, `autorizada`, `observada`, `rechazada`.
- All DateTimes stored as `TIMESTAMPTZ`; date filters use `America/Asuncion` TZ via `AT TIME ZONE`.

## Review Focus

1. **Cobrador without AR payments today** — `efectivo_esperado` must be `0` (not NULL, not error) when no `receivable_payments` exist for `cobrador_id` on `fecha`; `diferencia` equals `efectivo_declarado`. Covered by `test_close_session_zero_ar_payments` in Task 2.
2. **Duplicate open session same cobrador same day** — second `POST route-sessions` for same cobrador+fecha must return 409 (UniqueViolation from UNIQUE constraint). Covered by `test_open_session_duplicate_returns_409` in Task 2.
3. **Concurrent supervisor authorization** — if two supervisors call `authorize` simultaneously, second must get 409 because `estado` is already `autorizada`. Covered by `test_authorize_already_authorized_returns_409` in Task 3.
4. **Partial bank deposit** — `POST treasury/bank-deposit` must accept a subset of authorized liquidations (not require all of them). Covered by `test_bank_deposit_partial_liquidations` in Task 3.
5. **Timezone filter in AR calculation** — daily cobro query must filter on `fecha::date AT TIME ZONE 'America/Asuncion' = :fecha` so UTC timestamps stored near midnight don't bleed into the wrong day. Covered by `test_close_session_timezone_boundary` in Task 2.

---

### Task 1: DB Migration and Models

**Files:**
- Create: `api/alembic/versions/20261014120000_caja_ruta_tesoreria.py`
- Create: `api/src/ruta_caja/__init__.py`
- Create: `api/src/ruta_caja/models.py`
- Test: `api/tests/test_ruta_caja_models.py`

**Interfaces:**
- Produces: `RouteSession`, `RouteLiquidation`, `RouteLiquidationItem`, `BankDeposit` — SQLAlchemy models importable from `api.src.ruta_caja.models`.

- [ ] **Step 1: Write the failing import test**

```python
# api/tests/test_ruta_caja_models.py
def test_models_importable():
    from api.src.ruta_caja.models import (
        RouteSession, RouteLiquidation, RouteLiquidationItem, BankDeposit
    )
    assert RouteSession.__tablename__ == "route_sessions"
    assert RouteLiquidation.__tablename__ == "route_liquidations"
    assert RouteLiquidationItem.__tablename__ == "route_liquidation_items"
    assert BankDeposit.__tablename__ == "bank_deposits"

def test_route_session_has_unique_constraint():
    from api.src.ruta_caja.models import RouteSession
    constraint_names = [c.name for c in RouteSession.__table_args__ if hasattr(c, 'name')]
    # UNIQUE(company_id, cobrador_id, fecha) must exist
    assert any("unique" in (n or "").lower() or "uq" in (n or "").lower() for n in constraint_names)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && python -m pytest tests/test_ruta_caja_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.src.ruta_caja'`

- [ ] **Step 3: Create `api/src/ruta_caja/__init__.py`** (empty)

- [ ] **Step 4: Create `api/src/ruta_caja/models.py`** with four models

Pattern: follow `api/src/accounts_receivable/models.py`. All models inherit from `api.src.db.Base`.

`RouteSession`:
```
id              UUID PK gen_random_uuid()
company_id      UUID NOT NULL index
cobrador_id     UUID NOT NULL
route_id        UUID nullable
fecha           Date NOT NULL
estado          String(20) NOT NULL default='abierta'
fondo_inicial   Numeric(18,0) NOT NULL default=0
fondo_sobrante  Numeric(18,0) nullable
opened_at       DateTime(tz=True) server_default=now()
closed_at       DateTime(tz=True) nullable
created_by      UUID NOT NULL
__table_args__: UniqueConstraint('company_id','cobrador_id','fecha', name='uq_route_session_cobrador_fecha')
               + Index('ix_route_sessions_company_fecha', 'company_id', 'fecha')
```

`RouteLiquidation`:
```
id                     UUID PK
route_session_id       UUID FK route_sessions.id NOT NULL
efectivo_declarado     Numeric(18,0) NOT NULL default=0
cheques_declarado      Numeric(18,0) NOT NULL default=0
pagares_declarado      Numeric(18,0) NOT NULL default=0
nc_aplicadas           Numeric(18,0) NOT NULL default=0
descuentos_autorizados Numeric(18,0) NOT NULL default=0
efectivo_esperado      Numeric(18,0) NOT NULL default=0
total_cobrado_ar       Numeric(18,0) NOT NULL default=0
estado                 String(20) NOT NULL default='pendiente'
supervisor_id          UUID nullable
observaciones          Text nullable
fecha_autorizacion     DateTime(tz=True) nullable
created_at             DateTime(tz=True) server_default=now()
```
Note: `diferencia` is NOT a stored column — compute it in the service as `efectivo_declarado - efectivo_esperado`. Postgres `GENERATED ALWAYS AS ... STORED` requires DDL tricks; instead expose it from the service layer.

`RouteLiquidationItem`:
```
id             UUID PK
liquidation_id UUID FK route_liquidations.id NOT NULL
tipo           String(10) NOT NULL  -- 'cheque' or 'pagare'
numero         String(50) NOT NULL
banco          String(100) nullable
monto          Numeric(18,0) NOT NULL
customer_id    UUID nullable
vencimiento    Date nullable
```

`BankDeposit`:
```
id                    UUID PK
company_id            UUID NOT NULL index
fecha                 Date NOT NULL
bank_name             String(150) NOT NULL
account_number        String(50) NOT NULL
monto_efectivo        Numeric(18,0) NOT NULL default=0
monto_cheques         Numeric(18,0) NOT NULL default=0
referencia            String(100) nullable
route_liquidation_ids JSONB NOT NULL server_default='[]'
cash_session_ids      JSONB NOT NULL server_default='[]'
observaciones         Text nullable
created_by            UUID NOT NULL
created_at            DateTime(tz=True) server_default=now()
Index: ix_bank_deposits_company_fecha on (company_id, fecha)
```

- [ ] **Step 5: Create Alembic migration** `api/alembic/versions/20261014120000_caja_ruta_tesoreria.py`

```python
"""Caja de Ruta y Tesorería — route_sessions, route_liquidations, route_liquidation_items, bank_deposits
Revision ID: 20261014120000
Revises: 20261013110000
Create Date: 2026-10-14 12:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261014120000"
down_revision = "20261013110000"
branch_labels = None
depends_on = None
```

`upgrade()`: create tables in order `route_sessions` → `route_liquidations` → `route_liquidation_items` → `bank_deposits`, with their indexes and the UniqueConstraint on `route_sessions(company_id, cobrador_id, fecha)`.
`downgrade()`: drop in reverse order.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd api && python -m pytest tests/test_ruta_caja_models.py -v`
Expected: PASS 2/2

- [ ] **Step 7: Commit**

```bash
git add api/src/ruta_caja/__init__.py api/src/ruta_caja/models.py \
        api/alembic/versions/20261014120000_caja_ruta_tesoreria.py \
        api/tests/test_ruta_caja_models.py
git commit -m "feat(ruta_caja): models and alembic migration 20261014120000"
```

---

### Task 2: Backend Service and Router

**Files:**
- Create: `api/src/ruta_caja/schemas.py`
- Create: `api/src/ruta_caja/service.py`
- Create: `api/src/ruta_caja/router.py`
- Modify: `api/src/main.py` — add `include_router` for ruta_caja router
- Test: `api/tests/test_ruta_caja_service.py`

**Interfaces:**
- Consumes: `RouteSession`, `RouteLiquidation`, `RouteLiquidationItem`, `BankDeposit` from Task 1.
- Produces: router at prefix `/api/v1/distribuidora/` with these endpoints:
  - `POST /route-sessions`
  - `GET /route-sessions`
  - `GET /route-sessions/{id}`
  - `POST /route-sessions/{id}/close`
  - `GET /route-liquidations/{id}`
  - `POST /route-liquidations/{id}/authorize`
  - `POST /route-liquidations/{id}/observe`
  - `POST /route-liquidations/{id}/reject`
  - `GET /treasury/daily-summary`
  - `POST /treasury/bank-deposit`

- [ ] **Step 1: Write failing service tests**

```python
# api/tests/test_ruta_caja_service.py
from unittest.mock import AsyncMock, MagicMock, patch
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
    # Simulate no existing session (execute returns empty)
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
    # Mock route session
    mock_session = MagicMock()
    mock_session.id = session_id
    mock_session.cobrador_id = cobrador_id
    mock_session.fecha = date.today()
    mock_session.estado = "abierta"
    db.get.return_value = mock_session
    # First execute: sum of receivable_payments (returns 120000)
    db.execute.return_value.scalar_one_or_none = MagicMock(return_value=120000)
    db.execute.return_value.scalar = MagicMock(return_value=120000)
    # Second execute: sum of all payments (returns 180000)
    db.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=120000)),  # efectivo_esperado
        MagicMock(scalar=MagicMock(return_value=180000)),  # total_cobrado_ar
    ]
    liq = await close_session(
        db, session_id=session_id,
        efectivo_declarado=115000,
        cheques_declarado=50000,
        pagares_declarado=15000,
        nc_aplicadas=0,
        descuentos_autorizados=0,
        items=[],
    )
    db.add.assert_called()
    # The RouteLiquidation added must have efectivo_esperado=120000
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
    liq = await close_session(
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
    # Verify the SQL text in the first execute call contains timezone logic
    first_call_sql = str(db.execute.call_args_list[0][0][0])
    assert "America/Asuncion" in first_call_sql or "AT TIME ZONE" in first_call_sql
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && python -m pytest tests/test_ruta_caja_service.py -v`
Expected: FAIL — `ImportError: cannot import name 'open_route_session' from 'api.src.ruta_caja.service'`

- [ ] **Step 3: Create `api/src/ruta_caja/schemas.py`**

Pydantic v2 models. Pattern: `from pydantic import BaseModel; class Config: from_attributes = True`.

```
RouteSessionCreate: company_id, cobrador_id, route_id (opt), fecha, fondo_inicial, created_by
RouteSessionResponse: id, company_id, cobrador_id, route_id, fecha, estado, fondo_inicial, 
                      fondo_sobrante, opened_at, closed_at, created_by, cobrador_nombre (opt str)
LiquidationItemCreate: tipo, numero, banco (opt), monto, customer_id (opt), vencimiento (opt)
CloseSessionRequest: efectivo_declarado, cheques_declarado, pagares_declarado, nc_aplicadas,
                     descuentos_autorizados, items: list[LiquidationItemCreate]
RouteLiquidationResponse: id, route_session_id, efectivo_declarado, cheques_declarado,
                          pagares_declarado, nc_aplicadas, descuentos_autorizados,
                          efectivo_esperado, total_cobrado_ar, diferencia (Decimal, computed),
                          estado, supervisor_id, observaciones, fecha_autorizacion, created_at
ObserveRequest: observaciones: str
BankDepositCreate: company_id, fecha, bank_name, account_number, monto_efectivo, monto_cheques,
                   referencia (opt), route_liquidation_ids: list[str], cash_session_ids: list[str],
                   observaciones (opt), created_by
BankDepositResponse: id + all fields
RouteSessionDetailResponse: RouteSessionResponse + liquidation (RouteLiquidationResponse opt) 
                             + ar_summary dict (total_efectivo, total_cheques, total_pagares, total_nc)
TreasuryDailySummaryResponse: fecha, rutas: list[dict], retail: dict, totales: dict
```

- [ ] **Step 4: Create `api/src/ruta_caja/service.py`**

Async functions:

```python
async def open_route_session(db, company_id, cobrador_id, route_id, fecha, fondo_inicial, created_by) -> RouteSession
async def list_route_sessions(db, company_id, fecha=None, cobrador_id=None, estado=None) -> list[RouteSession]
async def get_route_session_detail(db, session_id) -> dict  # session + AR summary + liquidation
async def close_session(db, session_id, efectivo_declarado, cheques_declarado, pagares_declarado, nc_aplicadas, descuentos_autorizados, items) -> RouteLiquidation
async def get_liquidation(db, liquidation_id) -> RouteLiquidation
async def authorize_liquidation(db, liquidation_id, supervisor_id) -> RouteLiquidation
async def observe_liquidation(db, liquidation_id, supervisor_id, observaciones) -> RouteLiquidation
async def reject_liquidation(db, liquidation_id, supervisor_id, observaciones) -> RouteLiquidation
async def get_treasury_daily_summary(db, company_id, fecha) -> dict
async def create_bank_deposit(db, data: BankDepositCreate) -> BankDeposit
```

Key logic for `close_session`:
- Load RouteSession, verify `estado == 'abierta'`, raise 404 if not found, 409 if not abierta.
- Calculate `efectivo_esperado`:
  ```sql
  SELECT COALESCE(SUM(monto), 0) FROM receivable_payments
  WHERE cobrador_id = :cid
    AND created_at::date AT TIME ZONE 'America/Asuncion' = :fecha
    AND tipo = 'efectivo'
  ```
  Treat `None` result as `0`.
- Calculate `total_cobrado_ar`:
  ```sql
  SELECT COALESCE(SUM(monto), 0) FROM receivable_payments
  WHERE cobrador_id = :cid
    AND created_at::date AT TIME ZONE 'America/Asuncion' = :fecha
  ```
- Create `RouteLiquidation` with `estado='pendiente'`, set `efectivo_esperado` and `total_cobrado_ar`.
- Create `RouteLiquidationItem` for each item in `items`.
- Set `RouteSession.estado = 'cerrada'`, `closed_at = now()`.
- `db.flush()` + `db.commit()`.

Key logic for `open_route_session`:
- Check for existing session: `SELECT * FROM route_sessions WHERE company_id=:c AND cobrador_id=:co AND fecha=:f`.
- If found: raise `HTTPException(409, "Sesión abierta del {fecha} pendiente de cierre")`.
- Create and add `RouteSession`.

Key logic for `authorize_liquidation`:
- Load by id; if `estado != 'pendiente'` raise `HTTPException(409, "Liquidación ya procesada")`.
- Set `estado='autorizada'`, `supervisor_id`, `fecha_autorizacion=now()`.

- [ ] **Step 5: Create `api/src/ruta_caja/router.py`**

```python
router = APIRouter(prefix="/api/v1/distribuidora", tags=["ruta-caja"])

@router.post("/route-sessions", dependencies=[Depends(require_auth)])
@router.get("/route-sessions", dependencies=[Depends(require_auth)])
@router.get("/route-sessions/{session_id}", dependencies=[Depends(require_auth)])
@router.post("/route-sessions/{session_id}/close", dependencies=[Depends(require_auth)])
@router.get("/route-liquidations/{liquidation_id}", dependencies=[Depends(require_auth)])
@router.post("/route-liquidations/{liquidation_id}/authorize", dependencies=[Depends(require_auth)])
@router.post("/route-liquidations/{liquidation_id}/observe", dependencies=[Depends(require_auth)])
@router.post("/route-liquidations/{liquidation_id}/reject", dependencies=[Depends(require_auth)])
@router.get("/treasury/daily-summary", dependencies=[Depends(require_auth)])
@router.post("/treasury/bank-deposit", dependencies=[Depends(require_auth)])
```

Each handler delegates to `service.*`, returns the response schema.

- [ ] **Step 6: Register router in `api/src/main.py`**

After the existing `distribuidora_tracking_router` import and include:
```python
from api.src.ruta_caja.router import router as ruta_caja_router
# ...
app.include_router(ruta_caja_router)
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd api && python -m pytest tests/test_ruta_caja_service.py tests/test_ruta_caja_models.py -v`
Expected: PASS 7/7 (2 model + 5 service)

- [ ] **Step 8: Commit**

```bash
git add api/src/ruta_caja/schemas.py api/src/ruta_caja/service.py api/src/ruta_caja/router.py \
        api/src/main.py api/tests/test_ruta_caja_service.py
git commit -m "feat(ruta_caja): service, schemas, router — 10 endpoints under /distribuidora/"
```

---

### Task 3: Treasury Endpoint and Bank Deposit

**Files:**
- Modify: `api/src/ruta_caja/service.py` — implement `get_treasury_daily_summary` and `create_bank_deposit`
- Test: `api/tests/test_ruta_caja_treasury.py`

**Interfaces:**
- Consumes: `BankDeposit` model from Task 1; `CashSession` model from `api.src.caja.models` (read-only).
- Produces: `GET /treasury/daily-summary` returns `TreasuryDailySummaryResponse`; `POST /treasury/bank-deposit` returns `BankDepositResponse`.

- [ ] **Step 1: Write failing treasury tests**

```python
# api/tests/test_ruta_caja_treasury.py
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
    db = _mock_db()
    # authorized liquidation
    liq = MagicMock()
    liq.id = "liq-1"
    liq.efectivo_declarado = 200000
    liq.cheques_declarado = 100000
    liq.pagares_declarado = 50000
    liq.estado = "autorizada"
    db.execute.side_effect = [
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[liq])))),  # rutas
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),      # retail
    ]
    result = await get_treasury_daily_summary(
        db, "00000000-0000-0000-0000-000000000010", date.today()
    )
    assert result["totales"]["total_efectivo"] == 200000
    assert result["totales"]["total_cheques"] == 100000


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
        route_liquidation_ids=[str(uuid.uuid4())],  # only 1 of many
        cash_session_ids=[],
        created_by=str(uuid.uuid4()),
    )
    result = await create_bank_deposit(db, data)
    db.add.assert_called_once()
    deposited = db.add.call_args[0][0]
    assert deposited.monto_efectivo == 150000
    assert len(deposited.route_liquidation_ids) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && python -m pytest tests/test_ruta_caja_treasury.py -v`
Expected: FAIL — function not implemented yet

- [ ] **Step 3: Implement `get_treasury_daily_summary` and `create_bank_deposit` in `service.py`**

`get_treasury_daily_summary(db, company_id, fecha)`:
- Query `route_sessions JOIN route_liquidations` WHERE `company_id=:c AND fecha=:f AND rl.estado='autorizada'`.
- For retail: query `cash_sessions` WHERE `company_id=:c AND fecha=:f AND estado='cerrada'` — sum `efectivo_contado` (read-only reference to caja module). Use raw SQL `text(...)` to avoid importing CashSession model.
- Return dict: `{fecha, rutas: [...], retail: {...}, totales: {total_efectivo, total_cheques, total_pagares}}`.

`create_bank_deposit(db, data)`:
- Create `BankDeposit` from data fields.
- `db.add(deposit); db.flush(); db.commit(); return deposit`.
- Does NOT validate that `route_liquidation_ids` covers all authorized liquidations — partial deposit is valid per spec.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd api && python -m pytest tests/test_ruta_caja_treasury.py tests/test_ruta_caja_service.py tests/test_ruta_caja_models.py -v`
Expected: PASS 9/9

- [ ] **Step 5: Commit**

```bash
git add api/src/ruta_caja/service.py api/tests/test_ruta_caja_treasury.py
git commit -m "feat(ruta_caja): treasury daily summary and bank deposit endpoint"
```

---

### Task 4: Frontend API Client and TypeScript Types

**Files:**
- Modify: `ui-web/src/api/index.ts` — add TypeScript types and `api.distribuidora.rutaCaja.*` methods

**Interfaces:**
- Consumes: endpoints from Task 2 and Task 3.
- Produces: `api.distribuidora.rutaCaja.*` methods and types `RouteSession`, `RouteLiquidation`, `LiquidationItem`, `BankDeposit`, `TreasuryDailySummary` usable by Tasks 5–7.

- [ ] **Step 1: Verify TypeScript compiles before changes**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20`
Expected: errors only in known files (LoyaltyPage.tsx, MapaPage.tsx — pre-existing) — no new errors.

- [ ] **Step 2: Add TypeScript types to `ui-web/src/api/index.ts`**

Search for existing `distribuidora:` block (around line 3885). Add types near the other distribuidora types:

```typescript
export interface RouteSession {
  id: string;
  company_id: string;
  cobrador_id: string;
  cobrador_nombre?: string;
  route_id?: string;
  fecha: string; // 'YYYY-MM-DD'
  estado: 'abierta' | 'cerrada' | 'liquidada' | 'observada';
  fondo_inicial: number;
  fondo_sobrante?: number;
  opened_at: string;
  closed_at?: string;
  created_by: string;
  liquidation?: RouteLiquidation;
  ar_summary?: { total_efectivo: number; total_cheques: number; total_pagares: number; total_nc: number };
}

export interface RouteLiquidation {
  id: string;
  route_session_id: string;
  efectivo_declarado: number;
  cheques_declarado: number;
  pagares_declarado: number;
  nc_aplicadas: number;
  descuentos_autorizados: number;
  efectivo_esperado: number;
  total_cobrado_ar: number;
  diferencia: number;
  estado: 'pendiente' | 'autorizada' | 'observada' | 'rechazada';
  supervisor_id?: string;
  observaciones?: string;
  fecha_autorizacion?: string;
  created_at: string;
  items?: LiquidationItem[];
}

export interface LiquidationItem {
  id: string;
  tipo: 'cheque' | 'pagare';
  numero: string;
  banco?: string;
  monto: number;
  customer_id?: string;
  vencimiento?: string;
}

export interface TreasuryDailySummary {
  fecha: string;
  rutas: Array<{ session_id: string; cobrador_nombre: string; efectivo: number; cheques: number; pagares: number }>;
  retail: { total_efectivo: number; session_count: number };
  totales: { total_efectivo: number; total_cheques: number; total_pagares: number };
}
```

- [ ] **Step 3: Add API methods inside the `distribuidora:` object**

```typescript
rutaCaja: {
  // Route sessions
  openSession: (data: { company_id: string; cobrador_id: string; route_id?: string; fecha: string; fondo_inicial: number }) =>
    client.post<RouteSession>('/v1/distribuidora/route-sessions', data),
  listSessions: (params: { company_id: string; fecha?: string; cobrador_id?: string; estado?: string }) =>
    client.get<RouteSession[]>('/v1/distribuidora/route-sessions', params),
  getSession: (id: string) =>
    client.get<RouteSession>(`/v1/distribuidora/route-sessions/${id}`),
  closeSession: (id: string, data: { efectivo_declarado: number; cheques_declarado: number; pagares_declarado: number; nc_aplicadas: number; descuentos_autorizados: number; items: Array<{ tipo: string; numero: string; banco?: string; monto: number; customer_id?: string; vencimiento?: string }> }) =>
    client.post<RouteLiquidation>(`/v1/distribuidora/route-sessions/${id}/close`, data),
  // Liquidations
  getLiquidation: (id: string) =>
    client.get<RouteLiquidation>(`/v1/distribuidora/route-liquidations/${id}`),
  authorizeLiquidation: (id: string) =>
    client.post<RouteLiquidation>(`/v1/distribuidora/route-liquidations/${id}/authorize`, {}),
  observeLiquidation: (id: string, observaciones: string) =>
    client.post<RouteLiquidation>(`/v1/distribuidora/route-liquidations/${id}/observe`, { observaciones }),
  rejectLiquidation: (id: string, observaciones: string) =>
    client.post<RouteLiquidation>(`/v1/distribuidora/route-liquidations/${id}/reject`, { observaciones }),
  // Treasury
  getDailySummary: (company_id: string, fecha: string) =>
    client.get<TreasuryDailySummary>('/v1/distribuidora/treasury/daily-summary', { company_id, fecha }),
  createBankDeposit: (data: { company_id: string; fecha: string; bank_name: string; account_number: string; monto_efectivo: number; monto_cheques: number; referencia?: string; route_liquidation_ids: string[]; cash_session_ids: string[]; observaciones?: string }) =>
    client.post<any>('/v1/distribuidora/treasury/bank-deposit', data),
},
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "ruta\|RouteSession\|RouteLiquidation\|Liquidation\|Treasury" | head -20`
Expected: no errors on the new types or methods

- [ ] **Step 5: Commit**

```bash
git add ui-web/src/api/index.ts
git commit -m "feat(ui): TypeScript types and API client methods for ruta_caja"
```

---

### Task 5: RendicionesPage — Cobrador View (mobile-friendly)

**Files:**
- Create: `ui-web/src/pages/distribuidora/RendicionesPage.tsx`
- Modify: `ui-web/src/App.tsx` — lazy import + routes

**Interfaces:**
- Consumes: `api.distribuidora.rutaCaja.*` from Task 4.
- Produces: route `distribuidora/rendiciones` accessible to cobradores.

- [ ] **Step 1: Create `ui-web/src/pages/distribuidora/RendicionesPage.tsx`**

Structure:
- `useEffect`: call `api.distribuidora.rutaCaja.listSessions({ company_id: COMPANY_ID, fecha: today, cobrador_id: currentUser.id })`.
- If no session: banner "No tenés sesión abierta hoy — contactá al supervisor".
- If session exists:
  - Status badge: `abierta` (blue) / `cerrada` (yellow) / `liquidada` (green) / `observada` (orange).
  - 4 stat cards: Fondo inicial | Cobrado AR (from `ar_summary.total_efectivo`) | Pagarés del día | NCs aplicadas.
  - Tabla de facturas cobradas (from `ar_summary` in `getSession` detail response).
  - If `liquidation` exists: show liquidation estado + `observaciones` (supervisor's note if `observada`).
  - If `estado == 'abierta'` and no liquidation: button "Rendir al supervisor" → modal.

Modal "Rendir al supervisor":
- Field: "Efectivo en mano" (number input).
- Field: "Cheques/Pagarés" — dynamic list with Add row: tipo (select), número, banco (opt), monto, vencimiento (opt).
- Submit calls `api.distribuidora.rutaCaja.closeSession(sessionId, data)`.
- On success: reload session; show success toast.

- [ ] **Step 2: Add route to `ui-web/src/App.tsx`**

Add lazy import:
```typescript
const RendicionesPage = lazy(() => import("./pages/distribuidora/RendicionesPage"))
```

Add to the distribuidora routes section:
```typescript
["distribuidora/rendiciones", <RendicionesPage />],
```

And add the Route element in the JSX section following the existing `distribuidora/rendimiento-vendedores` pattern.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | grep "RendicionesPage\|rendiciones" | head -10`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add ui-web/src/pages/distribuidora/RendicionesPage.tsx ui-web/src/App.tsx
git commit -m "feat(ui): RendicionesPage — cobrador daily settlement view"
```

---

### Task 6: LiquidacionesPage — Supervisor View

**Files:**
- Create: `ui-web/src/pages/distribuidora/LiquidacionesPage.tsx`
- Modify: `ui-web/src/App.tsx` — lazy import + route

**Interfaces:**
- Consumes: `api.distribuidora.rutaCaja.*` from Task 4; `RouteSession`, `RouteLiquidation` types.
- Produces: route `distribuidora/liquidaciones`.

- [ ] **Step 1: Create `ui-web/src/pages/distribuidora/LiquidacionesPage.tsx`**

Structure:
- Date picker header (default: today).
- Button "Abrir sesión" → modal: cobrador selector (dropdown), ruta (opt), fondo inicial (number).
  - Submit calls `api.distribuidora.rutaCaja.openSession(...)`.
- `useEffect`: call `api.distribuidora.rutaCaja.listSessions({ company_id: COMPANY_ID, fecha: selectedDate })`.
- Table columns: Cobrador | Ruta | Fondo | Cobrado AR | Declarado | Diferencia (red if negative, green if ≥0) | Estado badge | Acciones.
- Click row OR "Ver detalle" → Drawer panel:
  - Shows full reconciliation: expected vs declared, difference, items (cheques/pagarés).
  - Buttons: "Autorizar" (calls `authorizeLiquidation`) / "Observar" (calls `observeLiquidation`, asks for note) / "Rechazar" (calls `rejectLiquidation`, asks for note).
  - Disabled when `liquidation.estado != 'pendiente'`.
- After action: toast + reload list.

- [ ] **Step 2: Add route to `ui-web/src/App.tsx`**

Lazy import + route `distribuidora/liquidaciones`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | grep "LiquidacionesPage\|liquidaciones" | head -10`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add ui-web/src/pages/distribuidora/LiquidacionesPage.tsx ui-web/src/App.tsx
git commit -m "feat(ui): LiquidacionesPage — supervisor reconciliation view"
```

---

### Task 7: TesoreriaPage and Navigation Links

**Files:**
- Create: `ui-web/src/pages/distribuidora/TesoreriaPage.tsx`
- Modify: `ui-web/src/App.tsx` — lazy import + route
- Modify: `ui-web/src/pages/distribuidora/DistribuidoraPage.tsx` — add navigation links to 3 new pages

**Interfaces:**
- Consumes: `api.distribuidora.rutaCaja.getDailySummary`, `api.distribuidora.rutaCaja.createBankDeposit`.
- Produces: route `distribuidora/tesoreria`; navigation links in DistribuidoraPage.

- [ ] **Step 1: Create `ui-web/src/pages/distribuidora/TesoreriaPage.tsx`**

Structure:
- Date picker (default: today). On change: reload both panels.
- Panel "Cajas de Ruta" (collapsible, open by default):
  - Table: Cobrador | Efectivo | Cheques | Pagarés | Estado.
  - Only shows `autorizada` liquidations (from `rutas` in `getDailySummary`).
  - Row-level checkboxes: pre-selected all. Tesorero can uncheck some (partial deposit).
- Panel "Cajas Retail" (collapsible, open by default):
  - Simple summary from `retail` field: total_efectivo, session_count.
  - Read-only — no actions.
- Sticky footer: Total Efectivo a depositar (sum of checked rutas + retail efectivo) | Total Cheques.
- Button "Registrar depósito bancario" → modal:
  - Fields: banco (text), cuenta (text), nro boleta (text, optional), efectivo (pre-filled, editable), cheques (pre-filled, editable), notas (optional).
  - Submit: calls `createBankDeposit` with checked `route_liquidation_ids`.
  - On success: toast + reload.

- [ ] **Step 2: Add route + navigation links**

- Lazy import + route `distribuidora/tesoreria` in App.tsx.
- In `DistribuidoraPage.tsx`: add 3 navigation cards/links for Rendiciones, Liquidaciones, Tesorería — following the existing card pattern in that page.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "TesoreriaPage\|tesoreria\|LiquidacionesPage\|RendicionesPage" | head -10`
Expected: no errors

- [ ] **Step 4: Full TypeScript check (no new errors in distribuidora files)**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "distribuidora" | head -20`
Expected: empty (no distribuidora errors)

- [ ] **Step 5: Commit**

```bash
git add ui-web/src/pages/distribuidora/TesoreriaPage.tsx \
        ui-web/src/pages/distribuidora/DistribuidoraPage.tsx \
        ui-web/src/App.tsx
git commit -m "feat(ui): TesoreriaPage + navigation links in DistribuidoraPage"
```

---

### Task 8: Deploy to VM

**Files:**
- No new files; deployment steps only.

**Interfaces:**
- Consumes: all committed code from Tasks 1–7.
- Produces: migration applied on VM; APIs live; UI built and serving.

- [ ] **Step 1: Push branch to remote**

```bash
git push origin vertical/distribuidora
```

- [ ] **Step 2: SSH to VM and pull**

```bash
ssh intellihouse@minisforum-ia
cd ~/intelimarket
git pull origin vertical/distribuidora
```

- [ ] **Step 3: Apply migration**

```bash
cd api && alembic upgrade 20261014120000
```
Expected: `Running upgrade 20261013110000 -> 20261014120000, Caja de Ruta y Tesorería`

- [ ] **Step 4: Restart api-2 first, then api-1 (zero-downtime)**

```bash
# Kill api-2 (:8010) and restart
pkill -f "uvicorn.*8010" || true
nohup uvicorn api.src.main:app --host 0.0.0.0 --port 8010 >> ~/logs/api2.log 2>&1 &
sleep 5
# Kill api-1 (:8000) and restart
pkill -f "uvicorn.*8000" || true
nohup uvicorn api.src.main:app --host 0.0.0.0 --port 8000 >> ~/logs/api.log 2>&1 &
```

- [ ] **Step 5: Verify APIs are up**

```bash
curl -s http://localhost:8000/health | head -3
curl -s http://localhost:8010/health | head -3
```
Expected: `{"status":"ok"}` or 200 response from both.

- [ ] **Step 6: Build and deploy UI**

```bash
cd ~/intelimarket/ui-web
npm run build
# Static files served by nginx from dist/ — no further steps needed
```

- [ ] **Step 7: Smoke test new endpoints**

```bash
# Should return 401 (auth required) — means endpoint is registered
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/distribuidora/route-sessions
```
Expected: `401`

- [ ] **Step 8: Commit deploy confirmation**

```bash
# On local machine after confirming deploy OK
git tag deploy/ruta-caja-$(date +%Y%m%d)
git push origin vertical/distribuidora --tags
```
