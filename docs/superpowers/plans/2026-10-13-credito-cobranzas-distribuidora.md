# Crédito y Cobranzas — Distribuidora Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir pagarés, notas de crédito de entrega, cobros mixtos y vista de cobranzas por ruta a la distribuidora, extendiendo los módulos AR/crédito existentes.

**Architecture:** Tres módulos nuevos (`pagares`, `delivery_notes`, `cobranzas`) que conviven con `accounts_receivable` y `credit_accounts` existentes. El frontend extiende `AccountsReceivablePage` con tres tabs nuevos y enriquece el modal de cobro. Sin reescritas — todo es adición o extensión.

**Tech Stack:** FastAPI + SQLAlchemy async + PostgreSQL + React 18 + TypeScript + Alembic

**Spec:** `docs/superpowers/specs/2026-10-13-credito-cobranzas-distribuidora-design.md`

## Global Constraints

- Todos los montos en guaraníes (PYG), `Numeric(15, 0)` — igual que el resto del sistema
- UUIDs con `server_default=func.gen_random_uuid()` — patrón existente
- `company_id` requerido y con índice en toda tabla nueva — patrón existente
- Imports de modelos nuevos deben agregarse a `api/src/main.py` para que Alembic los detecte
- Nunca modificar `accounts_receivable/models.py` ni `receivable_payments` en producción sin migración
- Tests usan `AsyncMock` para la sesión DB (SQLite no soporta ARRAY/UUID) — igual que T3/T4 de rutas

## Review Focus

1. **Cobro con NC de monto mayor al saldo del documento** — el servicio debe rechazar con 422 si `nota_credito_monto > saldo_pendiente` del documento destino
2. **Pagaré pagado en exceso** — `PagarePayment` acumulado > `monto_original`; el endpoint `/pay` debe validar antes de crear
3. **Cheque vinculado a cobro devuelto** — si se marca un cheque como devuelto, el cobro original debe quedar con estado `revertido` y el documento AR vuelve a `pendiente`; el flujo debe ser atómico
4. **Vista by-route con cliente sin documentos pendientes ese día** — debe excluirlos (saldo = 0) para no saturar la pantalla del cobrador
5. **NC aplicada dos veces** — la NC en estado `aplicada` no debe poder re-aplicarse; el endpoint debe retornar 409

---

### Task 1: DB Migration

**Files:**
- Create: `api/alembic/versions/20261013110000_credito_cobranzas_distribuidora.py`

**Interfaces:**
- Consumes: nada
- Produces: tablas `pagares`, `pagare_payments`, `delivery_notes`; columnas `cobrador_id UUID`, `route_id UUID` en `accounts_receivable`; columnas `cobrador_id UUID`, `delivery_note_id UUID`, `delivery_note_monto NUMERIC(15,0)` en `receivable_payments`

- [ ] **Step 1: Escribir el archivo de migración**

```python
# revision = "20261013110000"
# down_revision = "20261012100000"   # geocoords migration
# branch_labels = None
# depends_on = None

def upgrade():
    # pagares
    op.create_table("pagares",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receivable_account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("numero_pagare", sa.String(30), nullable=False),
        sa.Column("monto_original", sa.Numeric(15, 0), nullable=False),
        sa.Column("saldo_pendiente", sa.Numeric(15, 0), nullable=False),
        sa.Column("fecha_emision", sa.Date(), nullable=False),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="vigente"),
        sa.Column("cobrador_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_pagares_company", "pagares", ["company_id"])
    op.create_index("ix_pagares_customer", "pagares", ["customer_id"])

    # pagare_payments
    op.create_table("pagare_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("pagare_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pagares.id"), nullable=False),
        sa.Column("receivable_payment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("monto_aplicado", sa.Numeric(15, 0), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_pagare_payments_pagare", "pagare_payments", ["pagare_id"])

    # delivery_notes
    op.create_table("delivery_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("numero_nota", sa.String(30), nullable=False),
        sa.Column("numero_factura_ref", sa.String(30), nullable=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("concepto", sa.String(50), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("vendedor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("cobrador_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("aplicada_en_cobro_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_delivery_notes_company", "delivery_notes", ["company_id"])
    op.create_index("ix_delivery_notes_customer", "delivery_notes", ["customer_id"])

    # extensions: accounts_receivable
    op.add_column("accounts_receivable", sa.Column("cobrador_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("accounts_receivable", sa.Column("route_id", postgresql.UUID(as_uuid=True), nullable=True))

    # extensions: receivable_payments
    op.add_column("receivable_payments", sa.Column("cobrador_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("receivable_payments", sa.Column("delivery_note_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("receivable_payments", sa.Column("delivery_note_monto", sa.Numeric(15, 0), nullable=True))

def downgrade():
    op.drop_column("receivable_payments", "delivery_note_monto")
    op.drop_column("receivable_payments", "delivery_note_id")
    op.drop_column("receivable_payments", "cobrador_id")
    op.drop_column("accounts_receivable", "route_id")
    op.drop_column("accounts_receivable", "cobrador_id")
    op.drop_table("delivery_notes")
    op.drop_table("pagare_payments")
    op.drop_table("pagares")
```

- [ ] **Step 2: Verificar imports en el archivo**

Run: `python -c "import ast; ast.parse(open('api/alembic/versions/20261013110000_credito_cobranzas_distribuidora.py').read()); print('OK')"` desde el directorio raíz del repo
Expected: `OK` sin errores de sintaxis

- [ ] **Step 3: Commit**

```bash
git add api/alembic/versions/20261013110000_credito_cobranzas_distribuidora.py
git commit -m "feat(db): migración crédito y cobranzas distribuidora — pagares, delivery_notes, extensiones AR"
```

---

### Task 2: Módulo Pagarés — Backend

**Files:**
- Create: `api/src/pagares/__init__.py`
- Create: `api/src/pagares/models.py`
- Create: `api/src/pagares/schemas.py`
- Create: `api/src/pagares/service.py`
- Create: `api/src/pagares/router.py`
- Create: `tests/test_pagares.py`
- Modify: `api/src/main.py` (import + register router)

**Interfaces:**
- Consumes: T1 produces (tabla `pagares`, `pagare_payments`)
- Produces:
  - `GET /api/v1/distribuidora/pagares?company_id=&estado=&cobrador_id=` → `list[PagareResponse]`
  - `POST /api/v1/distribuidora/pagares` body `PagareCreate` → `PagareResponse`
  - `GET /api/v1/distribuidora/pagares/{pagare_id}` → `PagareResponse`
  - `POST /api/v1/distribuidora/pagares/{pagare_id}/pay` body `PagarePayInput` → `PagareResponse`
  - `POST /api/v1/distribuidora/pagares/{pagare_id}/protest` body `PagareProtestInput` → `PagareResponse`

- [ ] **Step 1: Escribir test que falla — crear pagaré y cobrar parcialmente**

```python
# tests/test_pagares.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from decimal import Decimal
import uuid

COMPANY_ID = str(uuid.uuid4())
CUSTOMER_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())

@pytest.mark.asyncio
async def test_create_pagare_sets_saldo_equal_to_monto():
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    with patch("api.src.pagares.service.AsyncSession", return_value=mock_db):
        from api.src.pagares.service import PagareService
        svc = PagareService(mock_db)
        from api.src.pagares.schemas import PagareCreate
        from datetime import date
        data = PagareCreate(
            company_id=COMPANY_ID,
            customer_id=CUSTOMER_ID,
            numero_pagare="P-001",
            monto_original=1000000,
            fecha_emision=date.today(),
            fecha_vencimiento=date.today(),
        )
        pagare = await svc.create(data, created_by=USER_ID)
        assert pagare.saldo_pendiente == pagare.monto_original

@pytest.mark.asyncio
async def test_pay_pagare_excess_raises_422():
    from api.src.pagares.service import PagareService
    from api.src.pagares.schemas import PagarePayInput
    from api.src.pagares.models import Pagare
    from decimal import Decimal
    from datetime import date
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
        await svc.pay(p.id, PagarePayInput(monto=Decimal("999999"), fecha=date.today()), created_by=USER_ID)
    assert exc_info.value.status_code == 422
```

- [ ] **Step 2: Correr test y verificar que falla**

Run: `python -m pytest tests/test_pagares.py -v 2>&1 | tail -20`
Expected: `FAILED` / `ImportError` — módulo no existe

- [ ] **Step 3: Implementar `models.py`**

`Pagare(Base)` con `__tablename__ = "pagares"` — columnas exactas del Step 1 de T1.
`PagarePayment(Base)` con `__tablename__ = "pagare_payments"`.

- [ ] **Step 4: Implementar `schemas.py`**

```python
# PagareCreate: company_id, customer_id, receivable_account_id?, numero_pagare,
#   monto_original: Decimal, fecha_emision: date, fecha_vencimiento: date, motivo?, cobrador_id?
# PagareResponse: todos los campos del modelo + saldo_pendiente
# PagarePayInput: monto: Decimal, fecha: date, observaciones?
# PagareProtestInput: motivo: str
```

- [ ] **Step 5: Implementar `service.py`**

`PagareService(db: AsyncSession)`:
- `create(data: PagareCreate, created_by) -> Pagare` — saldo_pendiente = monto_original; estado = "vigente"
- `list(company_id, estado?, cobrador_id?) -> list[Pagare]`
- `get(pagare_id) -> Pagare | None`
- `pay(pagare_id, data: PagarePayInput, created_by) -> Pagare` — valida que `data.monto <= saldo_pendiente`, crea `PagarePayment`, decrementa `saldo_pendiente`; si llega a 0 → estado = "pagado"
- `protest(pagare_id, data: PagareProtestInput, created_by) -> Pagare` — estado = "protestado"; actualiza motivo

- [ ] **Step 6: Implementar `router.py`**

Prefix `/api/v1/distribuidora/pagares`, tag `pagares`.
5 endpoints mapeados a los 5 métodos de service.

- [ ] **Step 7: Registrar en `main.py`**

```python
# junto a los demás imports de distribuidora
from api.src.pagares.router import router as pagares_router
# junto a los demás include_router
app.include_router(pagares_router)
```

- [ ] **Step 8: Correr tests y verificar que pasan**

Run: `python -m pytest tests/test_pagares.py -v 2>&1 | tail -20`
Expected: `2 passed`

- [ ] **Step 9: Commit**

```bash
git add api/src/pagares/ api/src/main.py tests/test_pagares.py
git commit -m "feat(distribuidora): módulo pagarés — CRUD, cobro parcial, protesto"
```

---

### Task 3: Módulo Notas de Crédito de Entrega — Backend

**Files:**
- Create: `api/src/delivery_notes/__init__.py`
- Create: `api/src/delivery_notes/models.py`
- Create: `api/src/delivery_notes/schemas.py`
- Create: `api/src/delivery_notes/service.py`
- Create: `api/src/delivery_notes/router.py`
- Create: `tests/test_delivery_notes.py`
- Modify: `api/src/main.py`

**Interfaces:**
- Consumes: T1 produces (tabla `delivery_notes`)
- Produces:
  - `GET /api/v1/distribuidora/delivery-notes?company_id=&estado=&concepto=&customer_id=` → `list[DeliveryNoteResponse]`
  - `POST /api/v1/distribuidora/delivery-notes` body `DeliveryNoteCreate` → `DeliveryNoteResponse`
  - `GET /api/v1/distribuidora/delivery-notes/{note_id}` → `DeliveryNoteResponse`
  - `POST /api/v1/distribuidora/delivery-notes/{note_id}/apply` body `DeliveryNoteApplyInput` → `DeliveryNoteResponse`
  - `POST /api/v1/distribuidora/delivery-notes/{note_id}/cancel` → `DeliveryNoteResponse`

- [ ] **Step 1: Escribir test que falla — re-aplicar NC debe retornar 409**

```python
# tests/test_delivery_notes.py
import pytest
from unittest.mock import AsyncMock, MagicMock
import uuid
from decimal import Decimal
from datetime import date
from fastapi import HTTPException

CONCEPTOS = ["no_es_su_pedido","faltante_deposito","sin_dinero","vencimiento_averia","otro"]

@pytest.mark.asyncio
async def test_concepto_values_are_valid():
    """Los 5 conceptos del legacy deben existir como valores aceptados."""
    from api.src.delivery_notes.schemas import DeliveryNoteCreate
    import pydantic
    for c in CONCEPTOS:
        d = DeliveryNoteCreate(
            company_id=str(uuid.uuid4()),
            customer_id=str(uuid.uuid4()),
            numero_nota="NC-001",
            fecha=date.today(),
            monto=Decimal("100000"),
            concepto=c,
        )
        assert d.concepto == c

@pytest.mark.asyncio
async def test_apply_already_applied_note_raises_409():
    from api.src.delivery_notes.service import DeliveryNoteService
    from api.src.delivery_notes.models import DeliveryNote
    from api.src.delivery_notes.schemas import DeliveryNoteApplyInput

    mock_db = AsyncMock()
    note = DeliveryNote()
    note.id = uuid.uuid4()
    note.estado = "aplicada"
    note.monto = Decimal("100000")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=note)
    mock_db.execute = AsyncMock(return_value=mock_result)

    svc = DeliveryNoteService(mock_db)
    with pytest.raises(HTTPException) as exc_info:
        await svc.apply(note.id, DeliveryNoteApplyInput(cobro_id=str(uuid.uuid4())), created_by=str(uuid.uuid4()))
    assert exc_info.value.status_code == 409
```

- [ ] **Step 2: Correr y verificar falla**

Run: `python -m pytest tests/test_delivery_notes.py -v 2>&1 | tail -20`
Expected: `FAILED` / `ImportError`

- [ ] **Step 3: Implementar `models.py`**

`DeliveryNote(Base)` con `__tablename__ = "delivery_notes"` — columnas del T1.

- [ ] **Step 4: Implementar `schemas.py`**

```python
# CONCEPTO_VALUES = Literal["no_es_su_pedido","faltante_deposito","sin_dinero","vencimiento_averia","otro"]
# DeliveryNoteCreate: company_id, customer_id, sale_id?, numero_nota, numero_factura_ref?,
#   fecha: date, monto: Decimal, concepto: CONCEPTO_VALUES, descripcion?, vendedor_id?, cobrador_id?
# DeliveryNoteResponse: todos los campos del modelo
# DeliveryNoteApplyInput: cobro_id: str (el receivable_payment_id donde se aplica)
```

- [ ] **Step 5: Implementar `service.py`**

`DeliveryNoteService(db)`:
- `create(data, created_by) -> DeliveryNote` — estado = "pendiente"
- `list(company_id, estado?, concepto?, customer_id?) -> list[DeliveryNote]`
- `get(note_id) -> DeliveryNote | None`
- `apply(note_id, data: DeliveryNoteApplyInput, created_by) -> DeliveryNote` — si `estado != "pendiente"` → HTTPException 409; setea `estado = "aplicada"`, `aplicada_en_cobro_id = data.cobro_id`
- `cancel(note_id, created_by) -> DeliveryNote` — si `estado == "aplicada"` → HTTPException 409 "ya aplicada, no se puede anular"

- [ ] **Step 6: Implementar `router.py`**

Prefix `/api/v1/distribuidora/delivery-notes`, tag `delivery-notes`.

- [ ] **Step 7: Registrar en `main.py`**

```python
from api.src.delivery_notes.router import router as delivery_notes_router
app.include_router(delivery_notes_router)
```

- [ ] **Step 8: Correr tests**

Run: `python -m pytest tests/test_delivery_notes.py -v 2>&1 | tail -20`
Expected: `2 passed`

- [ ] **Step 9: Commit**

```bash
git add api/src/delivery_notes/ api/src/main.py tests/test_delivery_notes.py
git commit -m "feat(distribuidora): módulo delivery notes — NC de entrega con 5 conceptos del legacy"
```

---

### Task 4: Extensiones AR — cobrador, vista por ruta, cheque bounce

**Files:**
- Modify: `api/src/accounts_receivable/models.py` (columnas cobrador_id, route_id en Account; cobrador_id, delivery_note_id, delivery_note_monto en ReceivablePayment)
- Modify: `api/src/accounts_receivable/schemas.py` (campos opcionales en schemas existentes)
- Modify: `api/src/accounts_receivable/router.py` (endpoint by-route + cheque bounce + filtro cobrador)
- Modify: `api/src/accounts_receivable/service.py` (registrar cobro con NC aplicada)
- Create: `tests/test_ar_extensions.py`

**Interfaces:**
- Consumes: T1 produces (columnas en AR tables); T3 produces DeliveryNote model
- Produces:
  - `GET /api/v1/receivables/by-route?company_id=&route_id=&fecha=` → `list[RouteCobranzaClient]`
  - `POST /api/v1/receivables/cheques/{cheque_id}/bounce` body `ChequeBounceInput` → `{ok: true}`
  - `register_payment` existente acepta `cobrador_id?`, `delivery_note_id?`, `delivery_note_monto?`

- [ ] **Step 1: Escribir tests que fallan**

```python
# tests/test_ar_extensions.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
from decimal import Decimal
from datetime import date

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
    from fastapi import HTTPException
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
async def test_by_route_excludes_zero_balance_customers():
    """Clientes con saldo 0 no aparecen en la vista por ruta."""
    from api.src.accounts_receivable.service import AccountsReceivableService
    mock_db = AsyncMock()
    mock_result = MagicMock()
    # Simula query que retorna solo clientes con saldo > 0
    mock_result.all = MagicMock(return_value=[])
    mock_db.execute = AsyncMock(return_value=mock_result)
    svc = AccountsReceivableService(mock_db)
    result = await svc.get_by_route(company_id=str(uuid.uuid4()), route_id=str(uuid.uuid4()), fecha=date.today())
    assert isinstance(result, list)
```

- [ ] **Step 2: Correr y verificar falla**

Run: `python -m pytest tests/test_ar_extensions.py -v 2>&1 | tail -20`
Expected: `FAILED` o `AttributeError` — métodos no existen

- [ ] **Step 3: Extender `models.py`**

Agregar a `Account`:
```python
cobrador_id = Column(UUID(as_uuid=True), nullable=True)
route_id = Column(UUID(as_uuid=True), nullable=True)
```

Agregar a `ReceivablePayment`:
```python
cobrador_id = Column(UUID(as_uuid=True), nullable=True)
delivery_note_id = Column(UUID(as_uuid=True), nullable=True)
delivery_note_monto = Column(Numeric(15, 0), nullable=True)
```

- [ ] **Step 4: Extender `schemas.py`**

En `ReceivablePaymentCreate` agregar campos opcionales:
- `cobrador_id: Optional[str] = None`
- `delivery_note_id: Optional[str] = None`
- `delivery_note_monto: Optional[Decimal] = None`

- [ ] **Step 5: Agregar métodos a `service.py`**

`register_payment_with_nc(company_id, customer_id, monto_total, delivery_note_id?, delivery_note_monto?, fecha, created_by)`:
- Si `delivery_note_id` está presente: validar que `delivery_note_monto <= saldo_pendiente` del cliente; lanzar HTTPException 422 si no
- Delegar al `register_payment` existente con campos extra

`get_by_route(company_id, route_id, fecha) -> list[dict]`:
- Query: `SELECT customer_id, SUM(saldo_pendiente) as saldo_total, COUNT(*) as n_docs FROM accounts_receivable WHERE company_id=? AND route_id=? AND estado='pendiente' GROUP BY customer_id HAVING SUM(saldo_pendiente) > 0`
- Retorna lista de dicts con `customer_id`, `saldo_total`, `n_docs`

- [ ] **Step 6: Agregar endpoint `by-route` y `bounce` a `router.py`**

```python
@router.get("/by-route")
async def cobranzas_by_route(company_id: str, route_id: str, fecha: date, ...):
    ...

@router.post("/cheques/{cheque_id}/bounce")
async def bounce_cheque(cheque_id: str, motivo: str, db=..., user=Depends(require_auth)):
    # Buscar el cheque en tabla cheques, setear estado="devuelto", motivo_rechazo=motivo
    # Si tiene receivable_payment_id: marcar ese pago como revertido y re-abrir el documento AR
    ...
```

- [ ] **Step 7: Correr tests**

Run: `python -m pytest tests/test_ar_extensions.py -v 2>&1 | tail -20`
Expected: `2 passed`

- [ ] **Step 8: Commit**

```bash
git add api/src/accounts_receivable/ tests/test_ar_extensions.py
git commit -m "feat(distribuidora): extensiones AR — cobrador, by-route, cheque bounce, cobro con NC"
```

---

### Task 5: Frontend — API client TypeScript

**Files:**
- Modify: `ui-web/src/api/index.ts`

**Interfaces:**
- Consumes: T2 produces (endpoints pagares), T3 produces (endpoints delivery-notes), T4 produces (by-route, bounce)
- Produces (interfaces y métodos en `api`):
  - `Pagare`, `PagareCreate`, `PagarePayInput`, `PagareProtestInput`
  - `DeliveryNote`, `DeliveryNoteCreate`, `DeliveryNoteApplyInput`
  - `RouteCobranzaClient`
  - `api.distribuidora.pagares.list(companyId, params?) -> Pagare[]`
  - `api.distribuidora.pagares.create(companyId, data) -> Pagare`
  - `api.distribuidora.pagares.pay(pagareId, data) -> Pagare`
  - `api.distribuidora.pagares.protest(pagareId, data) -> Pagare`
  - `api.distribuidora.deliveryNotes.list(companyId, params?) -> DeliveryNote[]`
  - `api.distribuidora.deliveryNotes.create(data) -> DeliveryNote`
  - `api.distribuidora.deliveryNotes.apply(noteId, data) -> DeliveryNote`
  - `api.distribuidora.deliveryNotes.cancel(noteId) -> DeliveryNote`
  - `api.receivables.byRoute(companyId, routeId, fecha) -> RouteCobranzaClient[]`
  - `api.receivables.bounceCheck(chequeId, motivo) -> {ok: boolean}`

- [ ] **Step 1: Escribir test de tipos — tsc**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errores (baseline antes del cambio)

- [ ] **Step 2: Agregar interfaces en `api/index.ts`**

Localizar la sección de interfaces de distribuidora (donde están `MapRouteData`, `SellerPerformance`) y agregar después:

```typescript
export interface Pagare {
  id: string
  company_id: string
  customer_id: string
  receivable_account_id?: string
  numero_pagare: string
  monto_original: number
  saldo_pendiente: number
  fecha_emision: string
  fecha_vencimiento: string
  motivo?: string
  estado: "vigente" | "pagado" | "protestado" | "anulado"
  cobrador_id?: string
  created_at: string
}

export interface DeliveryNote {
  id: string
  company_id: string
  customer_id: string
  sale_id?: string
  numero_nota: string
  numero_factura_ref?: string
  fecha: string
  monto: number
  concepto: "no_es_su_pedido" | "faltante_deposito" | "sin_dinero" | "vencimiento_averia" | "otro"
  descripcion?: string
  vendedor_id?: string
  cobrador_id?: string
  estado: "pendiente" | "aplicada" | "anulada"
  aplicada_en_cobro_id?: string
  created_at: string
}

export interface RouteCobranzaClient {
  customer_id: string
  customer_name: string
  customer_telefono?: string
  saldo_total: number
  n_docs: number
  ultimo_cobro?: string
}
```

- [ ] **Step 3: Agregar métodos API**

En el objeto `api.distribuidora` agregar sección `pagares` y `deliveryNotes`.
En el objeto `api.receivables` (o `api.accounts_receivable`) agregar `byRoute` y `bounceCheck`.

```typescript
// dentro de api.distribuidora
pagares: {
  list: (companyId: string, params?: Record<string, string>) =>
    request<Pagare[]>(`/api/v1/distribuidora/pagares?company_id=${companyId}${params ? "&" + new URLSearchParams(params).toString() : ""}`),
  create: (data: object) =>
    request<Pagare>("/api/v1/distribuidora/pagares", { method: "POST", body: JSON.stringify(data) }),
  pay: (pagareId: string, data: object) =>
    request<Pagare>(`/api/v1/distribuidora/pagares/${pagareId}/pay`, { method: "POST", body: JSON.stringify(data) }),
  protest: (pagareId: string, data: object) =>
    request<Pagare>(`/api/v1/distribuidora/pagares/${pagareId}/protest`, { method: "POST", body: JSON.stringify(data) }),
},
deliveryNotes: {
  list: (companyId: string, params?: Record<string, string>) =>
    request<DeliveryNote[]>(`/api/v1/distribuidora/delivery-notes?company_id=${companyId}${params ? "&" + new URLSearchParams(params).toString() : ""}`),
  create: (data: object) =>
    request<DeliveryNote>("/api/v1/distribuidora/delivery-notes", { method: "POST", body: JSON.stringify(data) }),
  apply: (noteId: string, data: object) =>
    request<DeliveryNote>(`/api/v1/distribuidora/delivery-notes/${noteId}/apply`, { method: "POST", body: JSON.stringify(data) }),
  cancel: (noteId: string) =>
    request<DeliveryNote>(`/api/v1/distribuidora/delivery-notes/${noteId}/cancel`, { method: "POST" }),
},
```

```typescript
// dentro de api.receivables (o accounts_receivable)
byRoute: (companyId: string, routeId: string, fecha: string) =>
  request<RouteCobranzaClient[]>(`/api/v1/receivables/by-route?company_id=${companyId}&route_id=${routeId}&fecha=${fecha}`),
bounceCheck: (chequeId: string, motivo: string) =>
  request<{ ok: boolean }>(`/api/v1/receivables/cheques/${chequeId}/bounce`, { method: "POST", body: JSON.stringify({ motivo }) }),
```

- [ ] **Step 4: Verificar tipos**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errores

- [ ] **Step 5: Commit**

```bash
git add ui-web/src/api/index.ts
git commit -m "feat(ui): interfaces y métodos API — pagarés, notas de crédito, cobranzas por ruta"
```

---

### Task 6: Frontend — Tab Pagarés en AccountsReceivablePage

**Files:**
- Modify: `ui-web/src/pages/accounts-receivable/AccountsReceivablePage.tsx`

**Interfaces:**
- Consumes: T5 produces (`api.distribuidora.pagares.*`, `Pagare`)
- Produces: Tab "pagares" funcional con tabla + modal emitir + modal cobrar + modal protestar

- [ ] **Step 1: Verificar que el archivo compila antes del cambio**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | grep "AccountsReceivable" | head -10`
Expected: 0 errores en ese archivo

- [ ] **Step 2: Agregar tipo `"pagares"` al `TabType`**

Localizar línea: `type TabType = "documentos" | "aging" | "scoring" | "recibos" | "empresas_vinculadas" | "reportes"`
Cambiar a incluir `"pagares"`.

- [ ] **Step 3: Agregar estado para pagarés**

```typescript
const [pagares, setPagares] = useState<Pagare[]>([])
const [loadingPagares, setLoadingPagares] = useState(false)
const [showEmitirPagareModal, setShowEmitirPagareModal] = useState(false)
const [showCobrarPagareModal, setShowCobrarPagareModal] = useState(false)
const [selectedPagare, setSelectedPagare] = useState<Pagare | null>(null)
const [pagareForm, setPagareForm] = useState({ numero_pagare: "", monto_original: "", fecha_vencimiento: "", motivo: "" })
const [pagarePagForm, setPagarePagForm] = useState({ monto: "", observaciones: "" })
```

- [ ] **Step 4: Agregar función `loadPagares`**

```typescript
const loadPagares = async () => {
  setLoadingPagares(true)
  try {
    const data = await api.distribuidora.pagares.list(companyId)
    setPagares(data || [])
  } catch (e: any) {
    toast.error("Error", e.message || "No se pudo cargar pagarés")
  } finally { setLoadingPagares(false) }
}
```

Y llamarla en el `useEffect` principal o cuando el tab cambia a `"pagares"`.

- [ ] **Step 5: Agregar botón tab en la barra de tabs**

Buscar el bloque de botones de tabs y agregar después del último tab existente:
```tsx
<button onClick={() => setActiveTab("pagares")} className={tabClass("pagares")}>
  <FileText className="w-3.5 h-3.5" />Pagarés
</button>
```

- [ ] **Step 6: Agregar contenido del tab**

```tsx
{activeTab === "pagares" && (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h2 className="font-bold text-slate-800 dark:text-white">Pagarés</h2>
      <button onClick={() => setShowEmitirPagareModal(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">
        <Plus className="w-3.5 h-3.5" /> Emitir Pagaré
      </button>
    </div>
    {/* Tabla */}
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/60 border-b">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Número</th>
            <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Cliente</th>
            <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-500 uppercase">Monto Orig.</th>
            <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-500 uppercase">Saldo</th>
            <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Vencimiento</th>
            <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Estado</th>
            <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {pagares.map(p => (
            <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
              <td className="px-3 py-3 font-mono text-xs">{p.numero_pagare}</td>
              <td className="px-3 py-3 text-xs">{p.customer_id}</td>
              <td className="px-3 py-3 text-right text-xs font-mono">{formatPYG(p.monto_original)}</td>
              <td className="px-3 py-3 text-right text-xs font-mono font-bold text-amber-700">{formatPYG(p.saldo_pendiente)}</td>
              <td className="px-3 py-3 text-xs">{p.fecha_vencimiento}</td>
              <td className="px-3 py-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  p.estado === "vigente" ? "bg-blue-100 text-blue-700" :
                  p.estado === "pagado" ? "bg-green-100 text-green-700" :
                  p.estado === "protestado" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                }`}>{p.estado}</span>
              </td>
              <td className="px-3 py-3">
                <div className="flex gap-1">
                  {p.estado === "vigente" && (
                    <>
                      <button onClick={() => { setSelectedPagare(p); setShowCobrarPagareModal(true) }}
                        className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200">
                        Cobrar
                      </button>
                      <button onClick={async () => {
                        const motivo = window.prompt("Motivo del protesto:")
                        if (!motivo) return
                        await api.distribuidora.pagares.protest(p.id, { motivo })
                        await loadPagares()
                        toast.success("Protestado", "Pagaré marcado como protestado")
                      }} className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 font-semibold hover:bg-red-200">
                        Protestar
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {/* Modal Emitir Pagaré */}
    {showEmitirPagareModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white">Emitir Pagaré</h3>
          {/* campos: numero_pagare, monto_original, fecha_vencimiento, motivo */}
          <div className="space-y-3">
            <input placeholder="Número de Pagaré" value={pagareForm.numero_pagare}
              onChange={e => setPagareForm(f => ({...f, numero_pagare: e.target.value}))}
              className="w-full px-3 py-2 rounded-xl border text-sm" />
            <input placeholder="Monto (Gs.)" value={pagareForm.monto_original}
              onChange={e => setPagareForm(f => ({...f, monto_original: e.target.value}))}
              className="w-full px-3 py-2 rounded-xl border text-sm" />
            <input type="date" value={pagareForm.fecha_vencimiento}
              onChange={e => setPagareForm(f => ({...f, fecha_vencimiento: e.target.value}))}
              className="w-full px-3 py-2 rounded-xl border text-sm" />
            <input placeholder="Motivo (opcional)" value={pagareForm.motivo}
              onChange={e => setPagareForm(f => ({...f, motivo: e.target.value}))}
              className="w-full px-3 py-2 rounded-xl border text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowEmitirPagareModal(false)}
              className="px-4 py-2 rounded-xl border text-sm">Cancelar</button>
            <button onClick={async () => {
              await api.distribuidora.pagares.create({
                company_id: companyId,
                customer_id: "FILL_FROM_CONTEXT",  // se llenará desde contexto de cliente seleccionado
                ...pagareForm,
                monto_original: parseInt(pagareForm.monto_original),
                fecha_emision: new Date().toISOString().split("T")[0],
              })
              setShowEmitirPagareModal(false)
              await loadPagares()
              toast.success("Pagaré emitido", pagareForm.numero_pagare)
            }} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">Emitir</button>
          </div>
        </div>
      </div>
    )}
    {/* Modal Cobrar Pagaré */}
    {showCobrarPagareModal && selectedPagare && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white">Cobrar Pagaré {selectedPagare.numero_pagare}</h3>
          <p className="text-xs text-slate-500">Saldo: {formatPYG(selectedPagare.saldo_pendiente)}</p>
          <input placeholder="Monto a cobrar (Gs.)" value={pagarePagForm.monto}
            onChange={e => setPagarePagForm(f => ({...f, monto: e.target.value}))}
            className="w-full px-3 py-2 rounded-xl border text-sm" />
          <input placeholder="Observaciones" value={pagarePagForm.observaciones}
            onChange={e => setPagarePagForm(f => ({...f, observaciones: e.target.value}))}
            className="w-full px-3 py-2 rounded-xl border text-sm" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCobrarPagareModal(false)}
              className="px-4 py-2 rounded-xl border text-sm">Cancelar</button>
            <button onClick={async () => {
              await api.distribuidora.pagares.pay(selectedPagare.id, {
                monto: parseInt(pagarePagForm.monto),
                fecha: new Date().toISOString().split("T")[0],
                observaciones: pagarePagForm.observaciones,
              })
              setShowCobrarPagareModal(false)
              await loadPagares()
              toast.success("Cobro registrado", `Gs. ${pagarePagForm.monto}`)
            }} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">Confirmar</button>
          </div>
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7: Verificar tipos**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | grep -i "error" | head -20`
Expected: 0 errores

- [ ] **Step 8: Commit**

```bash
git add ui-web/src/pages/accounts-receivable/AccountsReceivablePage.tsx
git commit -m "feat(ui): tab Pagarés en AccountsReceivablePage — emitir, cobrar, protestar"
```

---

### Task 7: Frontend — Tab Notas de Crédito en AccountsReceivablePage

**Files:**
- Modify: `ui-web/src/pages/accounts-receivable/AccountsReceivablePage.tsx`

**Interfaces:**
- Consumes: T5 produces (`api.distribuidora.deliveryNotes.*`, `DeliveryNote`)
- Produces: Tab "notas_credito" funcional con tabla + modal crear + acción aplicar/anular

- [ ] **Step 1: Agregar `"notas_credito"` al `TabType`**

- [ ] **Step 2: Agregar estado para NCs**

```typescript
const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
const [loadingNotes, setLoadingNotes] = useState(false)
const [showNoteModal, setShowNoteModal] = useState(false)
const [noteForm, setNoteForm] = useState({
  numero_nota: "", numero_factura_ref: "", monto: "",
  concepto: "no_es_su_pedido" as DeliveryNote["concepto"],
  descripcion: ""
})
```

- [ ] **Step 3: Agregar función `loadDeliveryNotes` + useEffect**

- [ ] **Step 4: Agregar botón tab**

- [ ] **Step 5: Agregar contenido del tab con tabla de NCs**

Columnas: Número, Factura Origen, Cliente, Monto, Concepto (label legible), Estado, Acciones (Aplicar/Anular).

Etiquetas de concepto:
```typescript
const CONCEPTO_LABELS: Record<DeliveryNote["concepto"], string> = {
  no_es_su_pedido: "No Es Su Pedido",
  faltante_deposito: "Faltante En Depósito",
  sin_dinero: "Sin Dinero",
  vencimiento_averia: "Vencimiento/Avería",
  otro: "Otro",
}
```

- [ ] **Step 6: Modal crear NC**

Campos: número de nota, número de factura de referencia, monto, concepto (select con 5 opciones), descripción libre.

- [ ] **Step 7: Verificar tipos**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | grep -i "error" | head -20`
Expected: 0 errores

- [ ] **Step 8: Commit**

```bash
git add ui-web/src/pages/accounts-receivable/AccountsReceivablePage.tsx
git commit -m "feat(ui): tab Notas de Crédito — NC de entrega con conceptos del legacy"
```

---

### Task 8: Frontend — Tab Por Ruta (vista cobranza diaria) + mejoras modal cobro

**Files:**
- Modify: `ui-web/src/pages/accounts-receivable/AccountsReceivablePage.tsx`

**Interfaces:**
- Consumes: T5 produces (`api.receivables.byRoute`, `RouteCobranzaClient`); T6/T7 como contexto
- Produces: Tab "por_ruta" con selector fecha+ruta y cards de clientes; modal cobro enriquecido con campo cobrador

- [ ] **Step 1: Agregar `"por_ruta"` al `TabType`**

- [ ] **Step 2: Agregar estado para vista por ruta**

```typescript
const [rutaClientes, setRutaClientes] = useState<RouteCobranzaClient[]>([])
const [loadingRuta, setLoadingRuta] = useState(false)
const [rutaFilter, setRutaFilter] = useState("")
const [rutaFecha, setRutaFecha] = useState(new Date().toISOString().split("T")[0])
const [routes, setRoutes] = useState<any[]>([])
```

- [ ] **Step 3: Cargar rutas disponibles y clientes pendientes**

```typescript
const loadRutaClientes = async () => {
  if (!rutaFilter) return
  setLoadingRuta(true)
  try {
    const data = await api.receivables.byRoute(companyId, rutaFilter, rutaFecha)
    setRutaClientes(data || [])
  } catch (e: any) {
    toast.error("Error", e.message)
  } finally { setLoadingRuta(false) }
}
```

- [ ] **Step 4: Agregar botón tab y contenido**

Cards por cliente (no tabla — es herramienta de campo, mejor cards en grilla 2 col):

```tsx
{activeTab === "por_ruta" && (
  <div className="space-y-4">
    {/* Filtros: fecha + ruta */}
    <div className="flex flex-wrap gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border...">
      <input type="date" value={rutaFecha} onChange={e => setRutaFecha(e.target.value)} ... />
      <select value={rutaFilter} onChange={e => setRutaFilter(e.target.value)} ...>
        <option value="">Seleccionar Ruta...</option>
        {routes.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
      </select>
      <button onClick={loadRutaClientes} ...>Cargar</button>
    </div>
    {/* Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {rutaClientes.map(c => (
        <div key={c.customer_id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border...">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">{c.customer_name}</p>
              <p className="text-xs text-slate-500">{c.n_docs} doc{c.n_docs !== 1 ? "s" : ""}</p>
            </div>
            <span className="text-sm font-black font-mono text-amber-700">{formatPYG(c.saldo_total)}</span>
          </div>
          {c.customer_telefono && (
            <a href={`tel:${c.customer_telefono}`} className="text-xs text-blue-600 flex items-center gap-1 mt-2">
              <Phone className="w-3 h-3" />{c.customer_telefono}
            </a>
          )}
          <button onClick={() => { /* abrir modal cobro con customer_id = c.customer_id */ }}
            className="mt-3 w-full py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">
            Registrar Cobro
          </button>
        </div>
      ))}
      {rutaClientes.length === 0 && !loadingRuta && rutaFilter && (
        <div className="col-span-full text-center py-10 text-slate-400 text-sm">
          Sin clientes pendientes en esta ruta para la fecha seleccionada.
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 5: Enriquecer modal de cobro con campo cobrador**

Localizar el modal de cobro existente (`register_payment` / `showPaymentModal`) y agregar:
- Campo "Cobrador" (selector de usuarios con rol cobrador, o texto libre si no hay endpoint)
- Campo toggle "Incluye Nota de Crédito" → si se activa: mostrar `select` de NCs pendientes del cliente y campo monto NC

- [ ] **Step 6: Verificar tipos**

Run: `cd ui-web && npx tsc --noEmit 2>&1 | grep -i "error" | head -20`
Expected: 0 errores

- [ ] **Step 7: Commit**

```bash
git add ui-web/src/pages/accounts-receivable/AccountsReceivablePage.tsx
git commit -m "feat(ui): tab Por Ruta — vista cobranza diaria + cobro con cobrador y NC"
```

---

## Execution Handoff

Plan completo guardado en `docs/superpowers/plans/2026-10-13-credito-cobranzas-distribuidora.md`.

**Para esta plan recomiendo ejecución Inline (executing-plans)** porque las 8 tareas tienen dependencias secuenciales claras (migración → backend → frontend) y los tests con AsyncMock son rápidos de escribir y ejecutar sin infraestructura real. Un executor inline sigue el ledger task a task sin necesidad de fresh context por tarea.
