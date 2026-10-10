# Pago mixto — Etapa 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ningún camino del POS pueda cerrar una venta con un cobro sin aprobar o sin rastro, y que cada línea de pago quede atada a su cobro real del terminal, con revisión visible de lo que no cuadra.

**Architecture:** El servidor gana columnas opcionales, una validación pura de suma que marca (nunca rechaza), un enlace atómico a los cobros del terminal y un panel con permiso propio. El POS gana un guardián de cierre puro (`validarCierre.ts`), un candado por terminal, un único campo de monto por línea y el envío de metadatos por línea.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic (Postgres); pytest con aiosqlite para los tests con base de datos; React/TypeScript (Vite) con tests `node --test` sobre módulos TS puros (Node 22).

**Spec:** `docs/superpowers/specs/2026-10-10-pago-mixto-etapa1-design.md`

## Global Constraints

- Tolerancia `TOLERANCIA_PAGOS_PYG = 50` (₲), igual en servidor y POS.
- El servidor **nunca rechaza** una venta por pagos o enlaces: solo marca `sales.pagos_revision` ∈ {`enlace_invalido`, `no_cuadran`, `no_verificable`}; prevalecen en ese orden.
- Columnas nuevas, todas nullable salvo `requiere_conciliacion`: `sale_payments.proveedor VARCHAR(20)`, `.terminal_transaction_id UUID` (índice), `.referencia VARCHAR(60)`, `.cuotas SMALLINT`, `.monto_pyg NUMERIC(15,0)`; `pos_terminal_transactions.requiere_conciliacion BOOLEAN NOT NULL DEFAULT false`, `.revisado_por UUID`, `.revisado_at TIMESTAMPTZ`; `sales.pagos_revision VARCHAR(20)`, `.pagos_diferencia NUMERIC(15,0)`, `.pagos_revisado_por UUID`, `.pagos_revisado_at TIMESTAMPTZ`.
- Migraciones Alembic: una sentencia por `op.execute` (asyncpg no acepta varias), `ADD COLUMN IF NOT EXISTS`, nombre `YYYYMMDDHHMMSS_descripcion.py`; `down_revision` = el único head al escribirla (`cd api && ../.venv/bin/alembic heads`; hoy `20261010160000`).
- Permiso `caja:revision_cobros` (módulo `caja`) para los roles Supervisor y Gerente; los endpoints usan `require_permission(...)` en el servidor. `rbac_role_permissions.tenant_id` (`00000000-0000-0000-0000-000000000001`) no es el `company_id`: tomarlo de la propia tabla.
- Archivos TS puros nuevos sin imports externos y con imports relativos con extensión `.ts`, para que `node --test` los ejecute (Node ≥22, `nvm use 22`). Los tests viven en `ui-web/tests/pos/`, fuera de `src` (el `tsconfig` solo incluye `src` y `types: ["vite/client"]`).
- Textos de UI en español con voseo, como el resto del POS.
- Cambios en `POSPage.tsx` mínimos y localizados: hay otro agente editando en paralelo. Commits **siempre con rutas explícitas** (`git commit -- <rutas>`), nunca `git add -A`. Mensajes terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- No reiniciar la API ni desplegar hasta la Task 12. Todo corre en la VM `intellihouse@100.83.91.76`, repo `/home/intellihouse/intelimarket`; comandos Python con `PYTHONPATH=.` desde la raíz del repo.

## Review Focus

1. Línea en R$/US$ sin `monto_pyg` (POS viejo o venta en cola offline): se guarda y queda `no_verificable`; jamás 500 ni rechazo. → Task 2, 3
2. `terminal_transaction_id` de otra empresa, ya enlazado a otra venta, inexistente o repetido en dos líneas: venta guardada, cobro ajeno intacto, `enlace_invalido`. → Task 3
3. Efectivo con vuelto (recibido > total) cierra; exceso con solo tarjetas no. → Task 5
4. Borde de tolerancia: diferencia de 50 pasa, de 51 se marca/rechaza. → Task 2, 5
5. Payload viejo sin ningún campo nuevo (cola offline): crea la venta como hoy. → Task 1, 3

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `api/alembic/versions/20261010170000_pagos_mixtos_etapa1.py` (nuevo) | DDL de las columnas nuevas |
| `api/alembic/versions/20261010170100_permiso_revision_cobros.py` (nuevo) | Datos: permiso y asignación a roles |
| `api/src/sales/pagos_revision.py` (nuevo) | Lógica pura de suma/marcas + enlace atómico + registro de líneas |
| `api/src/caja/revision_cobros.py` (nuevo) | Consultas y router del panel "Revisión de cobros" |
| `ui-web/src/pages/pos/validarCierre.ts` (nuevo) | Guardián de cierre puro |
| `ui-web/src/pages/pos/terminalLock.ts` (nuevo) | Mutex por IP de terminal, puro |
| `ui-web/src/pages/pos/useTerminalBusy.ts` (nuevo) | Hook React sobre `terminalLock` |
| `ui-web/src/pages/caja/RevisionCobrosTab.tsx` (nuevo) | UI del panel |
| `api/tests/test_pagos_mixtos.py`, `api/tests/test_revision_cobros.py`, `ui-web/tests/pos/validarCierre.test.ts`, `ui-web/tests/pos/terminalLock.test.ts` (nuevos) | Tests |
| Modificados | `api/src/sales/{models,schemas,service}.py`, `api/src/pos_terminal_transactions/{models,schemas}.py`, `api/src/rbac/schemas.py`, `api/src/main.py`, `pyproject.toml`, `api/pyproject.toml`, `ui-web/src/pages/pos/POSPage.tsx`, `ui-web/src/pages/caja/CajaPage.tsx`, `ui-web/src/api/index.ts` |

---

### Task 1: Migración, modelos y esquemas

**Files:**
- Create: `api/alembic/versions/20261010170000_pagos_mixtos_etapa1.py`
- Modify: `api/src/sales/models.py` (`SalePayment`, `Sale`), `api/src/sales/schemas.py` (`SalePaymentInput`), `api/src/pos_terminal_transactions/models.py`, `api/src/pos_terminal_transactions/schemas.py` (`PosTerminalTransactionCreate`, `PosTerminalTransactionResponse`)
- Test: `api/tests/test_pagos_mixtos.py`

**Interfaces:**
- Produces: `SalePaymentInput(forma_pago: str, monto: Decimal, moneda: str = "PYG", proveedor: Optional[str] = None, terminal_transaction_id: Optional[UUID] = None, referencia: Optional[str] = None, cuotas: Optional[int] = None, monto_pyg: Optional[Decimal] = None)`; atributos ORM con los nombres de Global Constraints; `PosTerminalTransactionCreate.requiere_conciliacion: bool = False`; `PosTerminalTransactionResponse` expone `sale_id`, `requiere_conciliacion`.

- [ ] **Step 1: Write the failing tests** (`class TestEsquemas` en `api/tests/test_pagos_mixtos.py`)

```python
def test_payload_viejo_sigue_valido():
    p = SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("1000"))
    assert p.proveedor is None and p.terminal_transaction_id is None and p.monto_pyg is None

def test_payload_nuevo_acepta_campos_opcionales():
    tid = uuid4()
    p = SalePaymentInput(forma_pago="TARJETA CREDITO", monto=Decimal("5000"), proveedor="bancard",
                         terminal_transaction_id=tid, referencia="123456", cuotas=3, monto_pyg=Decimal("5000"))
    assert (p.proveedor, p.terminal_transaction_id, p.cuotas) == ("bancard", tid, 3)

def test_monto_debe_ser_positivo():
    with pytest.raises(ValidationError):
        SalePaymentInput(forma_pago="EFECTIVO", monto=Decimal("0"))

def test_modelos_tienen_las_columnas_nuevas():
    for col in ("proveedor", "terminal_transaction_id", "referencia", "cuotas", "monto_pyg"):
        assert hasattr(SalePayment, col)
    for col in ("pagos_revision", "pagos_diferencia", "pagos_revisado_por", "pagos_revisado_at"):
        assert hasattr(Sale, col)
    for col in ("requiere_conciliacion", "revisado_por", "revisado_at"):
        assert hasattr(PosTerminalTransaction, col)
```

- [ ] **Step 2: Run to verify it fails** — `PYTHONPATH=. .venv/bin/python -m pytest api/tests/test_pagos_mixtos.py -v` → FAIL (`AttributeError`/`ImportError` por columnas inexistentes).
- [ ] **Step 3: Implement** las columnas en los modelos (tipos de Global Constraints; `requiere_conciliacion` con `default=False, server_default=text("false")`) y los campos opcionales en `SalePaymentInput` y en los dos esquemas del terminal.
- [ ] **Step 4: Create the migration** `20261010170000_pagos_mixtos_etapa1.py`: `upgrade()` hace un `op.execute("ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...")` por columna y `CREATE INDEX IF NOT EXISTS ix_sale_payments_terminal_tx ON sale_payments (terminal_transaction_id)`; `downgrade()` borra índice y columnas con `DROP COLUMN IF EXISTS`.
- [ ] **Step 5: Verify the migration without touching the DB** — `cd api && ../.venv/bin/alembic heads` → exactamente un head, `20261010170000`; `../.venv/bin/alembic upgrade 20261010160000:20261010170000 --sql` → imprime los 12 `ADD COLUMN` y el índice, exit 0.
- [ ] **Step 6: Run tests** — mismo comando del Step 2 → PASS.
- [ ] **Step 7: Commit** (`git add` de los 6 archivos de la tarea; `git commit -m "feat(pagos): columnas y esquemas para lineas de pago enlazadas" -- <rutas>`).

---

### Task 2: Lógica pura de pagos (`pagos_revision.py`)

**Files:**
- Create: `api/src/sales/pagos_revision.py`
- Test: `api/tests/test_pagos_mixtos.py` (`class TestEvaluarPagos`)

**Interfaces:**
- Produces:
  ```python
  TOLERANCIA_PAGOS_PYG = Decimal("50")
  @dataclass(frozen=True)
  class LineaPago: forma_pago: str; monto: Decimal; moneda: str; monto_pyg: Decimal | None
  def evaluar_pagos(total: Decimal, lineas: Sequence[LineaPago]) -> tuple[str | None, Decimal | None]
  def marca_prevalente(*marcas: str | None) -> str | None
  def forma_pago_resumen(formas_pago: Sequence[str], condicion: str) -> str
  ```

- [ ] **Step 1: Write the failing tests**

```python
def test_suma_exacta_no_marca():          # 60.000 EFECTIVO + 40.000 TARJETA DEBITO, total 100.000
    assert evaluar_pagos(D(100000), [L("EFECTIVO", 60000), L("TARJETA DEBITO", 40000)]) == (None, None)
def test_diferencia_de_mas():             # suma 100.500
    assert evaluar_pagos(D(100000), [L("EFECTIVO", 100500)]) == ("no_cuadran", D(500))
def test_diferencia_de_menos():           # suma 99.000
    assert evaluar_pagos(D(100000), [L("EFECTIVO", 99000)]) == ("no_cuadran", D(-1000))
def test_borde_tolerancia():              # Review Focus 4
    assert evaluar_pagos(D(100000), [L("QR", 100050)]) == (None, None)
    assert evaluar_pagos(D(100000), [L("QR", 100051)]) == ("no_cuadran", D(51))
def test_sin_lineas_no_valida():
    assert evaluar_pagos(D(100000), []) == (None, None)
def test_linea_extranjera_sin_monto_pyg():  # Review Focus 1
    assert evaluar_pagos(D(200000), [L("EFECTIVO", D("20.00"), "BRL"), L("EFECTIVO", 50000)]) == ("no_verificable", None)
def test_linea_extranjera_con_monto_pyg():  # BRL 20,00 = 148.000 Gs + 52.000 Gs = 200.000
    assert evaluar_pagos(D(200000), [L("EFECTIVO", D("20.00"), "BRL", D(148000)), L("EFECTIVO", 52000)]) == (None, None)
def test_prevalencia_de_marcas():
    assert marca_prevalente(None, "no_verificable", "no_cuadran") == "no_cuadran"
    assert marca_prevalente("enlace_invalido", "no_cuadran") == "enlace_invalido"
    assert marca_prevalente(None, None) is None
def test_forma_pago_resumen():
    assert forma_pago_resumen([], "contado") == "EFECTIVO"
    assert forma_pago_resumen([], "credito") == "EXTRA_CLUB"
    assert forma_pago_resumen(["QR"], "contado") == "QR"
    assert forma_pago_resumen(["EFECTIVO", "QR"], "contado") == "MIXTO"
```
(`D = Decimal`; `L(forma, monto, moneda="PYG", monto_pyg=None)` helper local del test.)

- [ ] **Step 2: Run to verify it fails** — `PYTHONPATH=. .venv/bin/python -m pytest api/tests/test_pagos_mixtos.py -k "EvaluarPagos" -v` → FAIL (`ModuleNotFoundError: api.src.sales.pagos_revision`).
- [ ] **Step 3: Implement** las tres funciones y la constante. `evaluar_pagos`: sin líneas → `(None, None)`; alguna línea con `moneda != "PYG"` y `monto_pyg is None` → `("no_verificable", None)`; si no, `suma = Σ (monto_pyg ?? monto)` y se marca solo si `abs(suma − total) > TOLERANCIA_PAGOS_PYG`, con `diferencia = suma − total`. Prioridad de `marca_prevalente`: `enlace_invalido` > `no_cuadran` > `no_verificable`.
- [ ] **Step 4: Run tests** — mismo comando → PASS.
- [ ] **Step 5: Commit** (`api/src/sales/pagos_revision.py`, `api/tests/test_pagos_mixtos.py`).

---

### Task 3: Enlace atómico y registro de líneas en `create_sale`

**Files:**
- Modify: `api/src/sales/pagos_revision.py`, `api/src/sales/service.py` (en `create_sale`, el bucle `for p in data.payments:` ~668-680; en el listado de ventas, el armado de `payments_by_sale` ~1932), `pyproject.toml` y `api/pyproject.toml` (agregar `aiosqlite` a los extras `dev`)
- Test: `api/tests/test_pagos_mixtos.py` (`class TestVincularCobros`, `class TestRegistrarPagos`)

**Interfaces:**
- Consumes: Task 1 (`SalePaymentInput`, modelos), Task 2 (`LineaPago`, `evaluar_pagos`, `marca_prevalente`, `forma_pago_resumen`).
- Produces:
  ```python
  async def vincular_cobros_terminal(db: AsyncSession, company_id: UUID, sale_id: UUID, terminal_ids: Sequence[UUID]) -> list[UUID]  # ids que NO se pudieron enlazar
  async def registrar_pagos_de_venta(db: AsyncSession, *, company_id: UUID, sale: Any, pagos: Sequence[SalePaymentInput], ahora: datetime) -> None
  ```
  `sale` necesita `.id` y `.total`; la función fija `sale.pagos_revision` y `sale.pagos_diferencia`.

- [ ] **Step 1: Install the test dependency** — `.venv/bin/python -m pip install aiosqlite` y agregarlo a los dos `pyproject.toml`. Verificar: `.venv/bin/python -c "import aiosqlite"` sin error.
- [ ] **Step 2: Write the failing tests.** Fixture `sqlite_db` (engine `sqlite+aiosqlite://`, crea solo `PosTerminalTransaction.__table__` y `SalePayment.__table__` con `conn.run_sync(lambda c: Model.__table__.create(c))`; no usar `Base.metadata.create_all`).

```python
async def test_vincula_cobro_libre():            # devuelve [] y la fila queda con sale_id
async def test_cobro_de_otra_empresa_no_se_vincula():     # devuelve [id]; sale_id sigue None   (RF2)
async def test_cobro_ya_enlazado_a_otra_venta_no_se_pisa():# devuelve [id]; sale_id original intacto (RF2)
async def test_id_inexistente_se_reporta():               # devuelve [id]                        (RF2)
async def test_mismo_id_en_dos_lineas_es_idempotente():   # [id, id] -> devuelve []              (RF2)
async def test_registra_lineas_con_campos_nuevos():       # 2 SalePayment con proveedor/referencia/cuotas/monto_pyg; pagos_revision is None
async def test_payload_viejo_crea_lineas_como_antes():    # sin campos nuevos -> filas con NULL en ellos; sin marca   (RF5)
async def test_linea_brl_sin_monto_pyg_marca_no_verificable():  # (RF1)
async def test_enlace_ajeno_guarda_y_marca_enlace_invalido():   # filas guardadas; sale.pagos_revision == "enlace_invalido" (RF2)
```
Para `registrar_pagos_de_venta`, `sale` es un `SimpleNamespace(id=uuid4(), total=Decimal(...), pagos_revision=None, pagos_diferencia=None)`.

- [ ] **Step 3: Run to verify they fail** — `PYTHONPATH=. .venv/bin/python -m pytest api/tests/test_pagos_mixtos.py -k "Vincular or Registrar" -v` → FAIL (`ImportError`).
- [ ] **Step 4: Implement `vincular_cobros_terminal`**: deduplica `terminal_ids` conservando el orden y ejecuta por cada uno `UPDATE pos_terminal_transactions SET sale_id=:sale WHERE id=:id AND company_id=:company AND (sale_id IS NULL OR sale_id=:sale)`; si `rowcount == 0` el id va a la lista de devueltos. Usar el modelo/`update()` de SQLAlchemy, sin SQL específico de Postgres.
- [ ] **Step 5: Implement `registrar_pagos_de_venta`**: crea un `SalePayment` por pago con **`id=uuid4()` explícito** (SQLite no tiene `gen_random_uuid`) y todos los campos nuevos; arma `LineaPago` y calcula `evaluar_pagos(sale.total, ...)`; llama a `vincular_cobros_terminal` con los `terminal_transaction_id` presentes; fija `sale.pagos_revision = marca_prevalente("enlace_invalido" if no_vinculados else None, marca)` y `sale.pagos_diferencia`; `await db.flush()`. Nunca lanza por pagos o enlaces.
- [ ] **Step 6: Wire `service.py`**: en `create_sale` reemplazar el bucle de `db.add(SalePayment(...))` por `await registrar_pagos_de_venta(db, company_id=data.company_id, sale=sale, pagos=data.payments, ahora=now)`. En el listado de ventas, reemplazar la asignación `payments_by_sale[p.sale_id] = p.forma_pago` por la recolección de **todas** las formas de pago por venta y `forma_pago_resumen(formas, sale.condicion)`.
- [ ] **Step 7: Run tests** — comando del Step 3 → PASS; además `PYTHONPATH=. .venv/bin/python -c "from api.src.main import app"` sin error de import.
- [ ] **Step 8: Commit** (los 5 archivos de la tarea).

---

### Task 4: Permiso y panel "Revisión de cobros" (servidor)

**Files:**
- Create: `api/src/caja/revision_cobros.py`, `api/alembic/versions/20261010170100_permiso_revision_cobros.py`
- Modify: `api/src/rbac/schemas.py` (`DEFAULT_PERMISSIONS` y `DEFAULT_ROLES`), `api/src/main.py` (incluir el router)
- Test: `api/tests/test_revision_cobros.py`

**Interfaces:**
- Consumes: Task 1 (columnas), `record_audit_event(db, data: dict)` de `api/src/inteliaudit/service.py`.
- Produces:
  ```python
  TIPOS_REVISION = ("no_cuadran", "huerfanos", "multi_proveedor")
  async def listar_revision(db: AsyncSession, company_id: UUID, tipo: str, desde: datetime | None = None, hasta: datetime | None = None, ahora: datetime | None = None) -> list[dict]
  async def marcar_revisado(db: AsyncSession, company_id: UUID, tipo: str, item_id: UUID, user: dict) -> bool
  router  # GET /api/v1/caja/revision-cobros ; POST /api/v1/caja/revision-cobros/{tipo}/{item_id}/revisar  (ambos con require_permission("caja:revision_cobros"))
  ```
  Forma de los ítems: `no_cuadran` → `{id, numero, fecha, total, pagos_revision, pagos_diferencia}`; `huerfanos` → `{id, fecha, tipo_operacion, monto, punto_emision, exitosa, requiere_conciliacion, nombre_tarjeta, codigo_autorizacion}`; `multi_proveedor` → `{id, numero, fecha, total, proveedores}`. Una venta "revisada" (`pagos_revisado_at`) sale de `no_cuadran` y de `multi_proveedor`.

- [ ] **Step 1: Write the failing tests** (`test_revision_cobros.py`; fixture SQLite creando `Sale`, `SalePayment`, `PosTerminalTransaction`; helper `async def _venta(db, **campos) -> UUID` que completa con un valor neutro cada columna `NOT NULL` sin default de `Sale.__table__`).

```python
async def test_no_cuadran_lista_y_excluye_revisadas()
async def test_huerfanos_regla_15_minutos_o_requiere_conciliacion():
    # exitosa sin venta hace 20 min -> listada; hace 5 min -> no; requiere_conciliacion hace 1 min -> listada;
    # exitosa con sale_id -> no; con revisado_at -> no
async def test_multi_proveedor_solo_con_dos_proveedores_distintos():  # bancard+dinelco -> si; bancard+bancard -> no
async def test_marcar_revisado_registra_auditoria(monkeypatch):
    # monkeypatch api.src.caja.revision_cobros.record_audit_event (CAST AS JSONB no corre en SQLite);
    # llamada con accion == "cobro_revisado" y user_id; el ítem deja de listarse
async def test_endpoints_exigen_el_permiso(monkeypatch):
    # app.dependency_overrides[require_auth] y [get_db]; monkeypatch api.src.rbac.deps.service.check_permission
    # False -> 403 en GET y en POST ; True -> 200
```

- [ ] **Step 2: Run to verify it fails** — `PYTHONPATH=. .venv/bin/python -m pytest api/tests/test_revision_cobros.py -v` → FAIL (`ModuleNotFoundError`).
- [ ] **Step 3: Implement `revision_cobros.py`.** Las consultas usan solo SQL portable (la antigüedad de 15 minutos se calcula en Python: `ahora - timedelta(minutes=15)`). `marcar_revisado` fija `revisado_por/at` (terminal) o `pagos_revisado_por/at` (venta), llama a `record_audit_event` con `accion="cobro_revisado"`, `entidad` = `"cobro_terminal"` o `"venta"`, `entidad_id` = el id (UUID real) y devuelve `False` si no existe.
- [ ] **Step 4: Implement el permiso.** Agregar `("caja:revision_cobros", "Revisar cobros que no cuadran, huérfanos y multi-proveedor", "caja")` a `DEFAULT_PERMISSIONS` y a la lista de permisos de los roles "Supervisor" y "Gerente" en `DEFAULT_ROLES`. En la migración `20261010170100_...` (`down_revision = "20261010170000"`): `INSERT` idempotente del permiso en `rbac_permissions` y `INSERT ... ON CONFLICT DO NOTHING` en `rbac_role_permissions` para los roles de nombre Supervisor/Gerente y cada `tenant_id` existente en esa tabla. Verificar con `alembic upgrade 20261010170000:20261010170100 --sql`.
- [ ] **Step 5: Wire `main.py`** (`app.include_router(revision_cobros.router)`), igual que los demás routers.
- [ ] **Step 6: Run tests** — comando del Step 2 → PASS; `PYTHONPATH=. .venv/bin/python -c "from api.src.main import app"` sin error.
- [ ] **Step 7: Commit** (los 6 archivos de la tarea).

---

### Task 5: Guardián de cierre puro (`validarCierre.ts`)

**Files:**
- Create: `ui-web/src/pages/pos/validarCierre.ts`
- Test: `ui-web/tests/pos/validarCierre.test.ts`

**Interfaces:**
- Produces (sin imports):
  ```ts
  export const TOLERANCIA_PAGOS_PYG = 50
  export type MetodoLinea = "cash" | "bancard" | "dinelco" | "plugpay" | "qr" | "plugpay_credito" | "extra_club" | "otros"
  export type EstadoLinea = "confirmada" | "en_curso" | "sin_cobrar"
  export interface LineaCobro { id: string; metodo: MetodoLinea; montoPyg: number; estado: EstadoLinea; esExtra: boolean }
  export interface ContextoCierre { totalPyg: number; metodosActivos: MetodoLinea[]; extraClub?: { tieneLinea: boolean; saldoDisponible: number }; otrosCompleto?: boolean }
  export type CodigoRechazo = "linea_extra_sin_metodo_activo" | "linea_sin_confirmar" | "monto_invalido" | "extra_club_sin_saldo" | "otros_incompleto" | "suma_no_cuadra"
  export type ResultadoCierre = { ok: true } | { ok: false; codigo: CodigoRechazo; mensaje: string }
  export function validarCierre(lineas: LineaCobro[], ctx: ContextoCierre): ResultadoCierre
  export function totalConfirmadoPyg(lineas: LineaCobro[]): number
  ```
  Orden de evaluación = orden de `CodigoRechazo`. Efectivo se considera siempre `confirmada`.

- [ ] **Step 1: Write the failing tests** (`node:test` + `node:assert/strict`; import `../../src/pages/pos/validarCierre.ts`).

```ts
test("doble-Enter con tarjeta en curso no cierra")        // bancard "en_curso" -> { ok:false, codigo:"linea_sin_confirmar" }
test("linea extra qr sin metodo qr activo se rechaza")    // esExtra qr, metodosActivos sin "qr" -> "linea_extra_sin_metodo_activo"   (Task 10 oculta el boton; esto es la defensa)
test("monto cero se rechaza")                             // -> "monto_invalido"
test("extra club sin saldo se rechaza")                   // saldoDisponible < montoPyg -> "extra_club_sin_saldo"
test("otros incompleto se rechaza")                       // otrosCompleto:false -> "otros_incompleto"
test("efectivo con vuelto cierra")                        // total 100000, cash 120000 -> ok   (Review Focus 3)
test("exceso con solo tarjetas no cierra")                // total 100000, bancard confirmada 105000 -> "suma_no_cuadra"   (RF3)
test("falta cobrar no cierra")                            // confirmado 99000 -> "suma_no_cuadra"
test("borde de tolerancia")                               // confirmado 99950 ok ; 99949 -> "suma_no_cuadra"   (RF4)
test("suma de confirmadas, no de cargadas")               // 60000 confirmada + 40000 en_curso -> "linea_sin_confirmar"
test("totalConfirmadoPyg ignora lineas en curso y sin cobrar")
```

- [ ] **Step 2: Run to verify it fails** — `source ~/.nvm/nvm.sh && nvm use 22 && cd ui-web && node --test tests/pos/validarCierre.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3: Implement** `validarCierre` y `totalConfirmadoPyg` según la tabla. Exceso permitido solo si hay una línea `cash`; falta permitida hasta `TOLERANCIA_PAGOS_PYG`. Mensajes en voseo (p. ej. `"Hay un cobro sin confirmar: completalo o quitalo antes de continuar."`).
- [ ] **Step 4: Run tests** — mismo comando → PASS (11 tests).
- [ ] **Step 5: Commit** (los 2 archivos).

---

### Task 6: Candado por terminal (`terminalLock.ts`, `useTerminalBusy.ts`)

**Files:**
- Create: `ui-web/src/pages/pos/terminalLock.ts`, `ui-web/src/pages/pos/useTerminalBusy.ts`
- Test: `ui-web/tests/pos/terminalLock.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // terminalLock.ts (sin imports)
  export interface TerminalLock { tryAcquire(ip: string): boolean; release(ip: string): void; isBusy(ip: string): boolean; subscribe(fn: () => void): () => void }
  export function createTerminalLock(opts?: { timeoutMs?: number; now?: () => number }): TerminalLock
  export const terminalLock: TerminalLock   // singleton de la app
  // useTerminalBusy.ts
  export function useTerminalBusy(ip: string | undefined): boolean   // useSyncExternalStore sobre terminalLock
  ```
  `timeoutMs` por defecto **190_000**: un cobro Bancard son dos llamadas de hasta 90 s (`/pos/venta-ux` y `/pos/descuento`) y el candado debe cubrir ambas (el spec habla de 90 s por llamada).

- [ ] **Step 1: Write the failing tests**

```ts
test("segundo tryAcquire en la misma IP falla hasta release")
test("IPs distintas son independientes")
test("release es idempotente y libera")
test("el candado vence por timeout", () => { /* now() inyectado: acquire, avanzar timeoutMs+1, tryAcquire -> true */ })
test("subscribe se notifica al adquirir y al liberar, y el desuscriptor funciona")
```

- [ ] **Step 2: Run to verify it fails** — `node --test tests/pos/terminalLock.test.ts` (con Node 22) → FAIL.
- [ ] **Step 3: Implement** `createTerminalLock` (un `Map<string, number>` de IP → instante de vencimiento) y el singleton; `useTerminalBusy` con `useSyncExternalStore` (`subscribe` = `terminalLock.subscribe`, snapshot = `terminalLock.isBusy(ip)`; `false` si `ip` es `undefined`).
- [ ] **Step 4: Run tests** — PASS; `cd ui-web && npx tsc --noEmit` sin errores.
- [ ] **Step 5: Commit** (los 3 archivos).

---

### Task 7: POS — un solo campo de monto por línea (hallazgo 9)

**Files:**
- Modify: `ui-web/src/pages/pos/POSPage.tsx`

**Interfaces:**
- Produces: dentro del componente, `const montoLineaPrincipalPyg = (metodo: "bancard" | "dinelco"): number` — monto de la línea principal de ese método: `(isMultiPayment || extraPaymentLegs.some(l => l.method === metodo)) ? parseInt(<mixedCardPyg | mixedDinelcoPyg>…) : totalPyg`.

- [ ] **Step 1: Define `montoLineaPrincipalPyg`** junto a `getSaldoRestanteParaMetodo` (~6867) y usarla en los tres lugares que hoy repiten esa fórmula para Bancard y Dinelco: el memo de `recibido` (~6828-6832), el armado de `salePaymentsForCreate` (~7404, ~7420) y `getSaldoRestanteParaMetodo`.
- [ ] **Step 2: Cambiar los handlers de cobro QR/PIX** para leer ese mismo monto: `handleGenerateBancardCloudQr` y `handleBancardQR` usan `montoLineaPrincipalPyg("bancard")`; `handleDinelcoQR` usa `montoLineaPrincipalPyg("dinelco")`. No tocar los handlers de PlugPay (su campo escribe `mixedPlugPayPyg`, `mixedParceladoPyg` y `mixedQrPyg` a propósito).
- [ ] **Step 3: Unificar los campos "Monto QR en esta línea"** de los paneles Bancard `qr_zimple`, Bancard `qr_cloud` y Dinelco QR/PIX: su `value`/`onChange` y su botón "Resto" pasan a leer/escribir `mixedCardPyg` (Bancard) o `mixedDinelcoPyg` (Dinelco) en lugar de `mixedQrPyg`, con `getSaldoRestanteParaMetodo("bancard")` / `("dinelco")`. Si en esos paneles ya se muestra el campo "Monto Bancard en esta línea" arriba, dejar **uno solo** visible.
- [ ] **Step 4: Verify** — `cd ui-web && npx tsc --noEmit` sin errores; `grep -n "mixedQrPyg" src/pages/pos/POSPage.tsx` solo debe quedar en PlugPay (y el reset ~7114).
- [ ] **Step 5: Commit** (`ui-web/src/pages/pos/POSPage.tsx`).

---

### Task 8: POS — el guardián manda en `handleProcessCheckout`

**Files:**
- Modify: `ui-web/src/pages/pos/POSPage.tsx`

**Interfaces:**
- Consumes: Task 5 (`validarCierre`, `totalConfirmadoPyg`, tipos), Task 7 (`montoLineaPrincipalPyg`).
- Produces: en el componente, `construirLineasCobro(): LineaCobro[]` y `contextoCierre(): ContextoCierre`.

- [ ] **Step 1: Implement `construirLineasCobro`** (junto a `handleProcessCheckout`, ~7183). Una línea por método activo con monto > 0 más una por cada `extraPaymentLegs`. Estado: **Bancard** `confirmada` si `bancardTxnState === "aprobada" || posCardCupon.trim() || bancardQrManualConfirm || bancardCloudQrState === "aprobada" || bancardQrState === "aprobada"`; **Dinelco** si `dinelcoTxnState === "aprobada" || dinelcoCupon.trim() || dinelcoQrState === "aprobada"`; **PlugPay** si `plugpayState === "aprobada" || plugpayManualComprobante.trim()`; **leg** `confirmada` si `txnState === "aprobada" || manualCupon.trim()`, `en_curso` si `esperando | generando | confirmando`, si no `sin_cobrar`. Efectivo: una línea `cash` con `pyg + brl·rates.BRL + usd·rates.USD`, siempre `confirmada`. Extra Club y Otros: `confirmada` (sus chequeos van en el contexto). `esExtra` = `true` solo para legs.
- [ ] **Step 2: Implement `contextoCierre`** con `totalPyg`, `metodosActivos` (= `[...activeMethods]`), `extraClub` (`extraClubCredit.activo` y `saldo_disponible`, solo si el método está activo) y `otrosCompleto` (los mismos chequeos de transferencia/cheque/vale que hoy están en el `onClick`).
- [ ] **Step 3: En `handleProcessCheckout`**, justo después del chequeo de caja abierta, reemplazar el `if (saldoRestantePyg > 0 && …)` y el bloque de Extra Club por `const v = validarCierre(construirLineasCobro(), contextoCierre()); if (!v.ok) { toast.warning("No se puede cobrar todavía", v.mensaje); return }`.
- [ ] **Step 4: Adelgazar el `onClick` del botón de cobrar** (~13757): reemplazar los chequeos duplicados (Bancard, `legPendiente`, Dinelco, PlugPay, datos de Otros, saldo Extra Club) por la **misma** llamada a `validarCierre` con aviso, y conservar solo los pedidos de autorización de supervisor (`otros_payment`, `extra_club_payment`) y la llamada final a `handleProcessCheckout()`.
- [ ] **Step 5: "Recibido" solo con lo confirmado.** En el memo de `totalRecibidoPyg`/`saldoRestantePyg`/`vueltoPyg` (~6808), el aporte de métodos no-efectivo pasa a `totalConfirmadoPyg` de las líneas no-efectivo; las líneas en curso se muestran en el modal como "pendiente de confirmar ₲ X" (un texto bajo "Falta cobrar", sin sumar).
- [ ] **Step 6: Verify** — `cd ui-web && npx tsc --noEmit` sin errores; `grep -n "handleProcessCheckout()" src/pages/pos/POSPage.tsx` lista las mismas llamadas de antes (doble-Enter, supervisor, botón) y las tres pasan ahora por `validarCierre` dentro de la función.
- [ ] **Step 7: Commit** (`ui-web/src/pages/pos/POSPage.tsx`).

---

### Task 9: POS — líneas con proveedor, voucher y enlace (el servidor enlaza)

**Files:**
- Modify: `ui-web/src/pages/pos/POSPage.tsx` (`salePaymentsForCreate` ~7385-7510; bloque del enlace cliente ~8085-8100), `ui-web/src/api/index.ts` (tipo de `payments` en `sales.create`, ~2195; interfaz `PosTerminalTransaction`)

**Interfaces:**
- Consumes: Task 1 (campos de `SalePaymentInput`).
- Produces: cada línea de `salePaymentsForCreate` es `{ forma_pago, monto, moneda?, proveedor?: "bancard" | "dinelco" | "plugpay", terminal_transaction_id?: string, referencia?: string, cuotas?: number, monto_pyg: number }`.

- [ ] **Step 1: Tipos en `api/index.ts`**: ampliar el tipo de `payments` en `sales.create` con los cinco campos opcionales y agregar `requiere_conciliacion?: boolean` a `PosTerminalTransaction`.
- [ ] **Step 2: Completar cada línea** en `salePaymentsForCreate`. `proveedor`: `bancard` / `dinelco` / `plugpay` (efectivo, Extra Club y Otros sin proveedor). `terminal_transaction_id`: línea principal Bancard `bancardTxnLogId || bancardQrLogId`, Dinelco `dinelcoTxnLogId` (o el id de log del QR de Dinelco si existe), PlugPay su log si existe; legs `leg.logId`. `referencia`: voucher o autorización (`posCardCupon`, `dinelcoCupon`, `plugpayManualComprobante`, `leg.manualCupon`). `cuotas`: `posCardCuotas` o `leg.cardCuotas` cuando es crédito. `monto_pyg`: igual a `monto` en guaraníes; para las líneas de efectivo en R$/US$, el equivalente en Gs que cubre la venta (`netPygCoveredByBrl` y su análogo en US$).
- [ ] **Step 3: Quitar el enlace del cliente**: eliminar el bloque `const bancardLogId = … doLinkSale` (~8085-8100) y su `posTerminalTransactions.update(..., { sale_id })`, porque el servidor enlaza dentro de la transacción de la venta.
- [ ] **Step 4: Verify** — `cd ui-web && npx tsc --noEmit` sin errores; `grep -n "posTerminalTransactions.update" src/pages/pos/POSPage.tsx` sin resultados.
- [ ] **Step 5: Commit** (`ui-web/src/pages/pos/POSPage.tsx`, `ui-web/src/api/index.ts`).

---

### Task 10: POS — protecciones (candado, paso 2, cancelar, botones)

**Files:**
- Modify: `ui-web/src/pages/pos/POSPage.tsx`

**Interfaces:**
- Consumes: Task 6 (`terminalLock`, `useTerminalBusy`), Task 8 (`construirLineasCobro`).
- Produces: `conTerminal(ip: string, fn: () => Promise<void>): Promise<void>` y `lineasAprobadasSinVenta()` dentro del componente.

- [ ] **Step 1: Candado.** `conTerminal` hace `if (!terminalLock.tryAcquire(ip)) { toast.warning("Terminal ocupado", "Esperá a que termine el cobro en curso."); return }` y ejecuta `fn` dentro de `try/finally { terminalLock.release(ip) }`. Envolver los cuerpos de `handleBancardCharge`, `handleBancardChargeForLeg`, `handleBancardQR`, `handleBancardQRForLeg`, `handleDinelcoCharge`, `handleDinelcoChargeForLeg`, `handleDinelcoQR` y `handleDinelcoQRForLeg`. Con `useTerminalBusy(activePosConfig.bancardIp)` y `useTerminalBusy(activePosConfig.dinelcoIp)`, agregar `|| bancardBusy` / `|| dinelcoBusy` al `disabled` de cada botón que invoca esos handlers (localizarlos con `grep -n "onClick={() => handleBancardChargeForLeg\|onClick={handleBancardQR\|onClick={() => handleDinelco"`).
- [ ] **Step 2: Paso 2 de Bancard cortado.** En `handleBancardCharge` y `handleBancardChargeForLeg`, en la rama de error de red de `/pos/descuento` (`res2` sin `status` 400/500), llamar a `logBancardTxn({ tipo_operacion, exitosa: false, requiere_conciliacion: true, bin, nsu, monto, terminal_ip, factura_nro_provisional, error_message })`.
- [ ] **Step 3: Cancelar con cobros aprobados.** `lineasAprobadasSinVenta()` devuelve las líneas (principal y legs) en estado `confirmada` no efectivo, con monto, proveedor y voucher. En la rama `clear_cart` de la acción de supervisor (~5819), si hay alguna, mostrar `confirm(...)` listándolas con el aviso "el terminal no devuelve nada solo"; si el cajero cancela, abortar; si confirma, `api.inteliaudit.recordEvent({ company_id: COMPANY_ID, user_id: user?.id, accion: "cobro_aprobado_cancelado", entidad: "cobro_terminal", datos_nuevos: { cobros: [...] } })` (sin `entidad_id`: es UUID y los ids locales no lo son). Pausar una venta no pasa por este camino.
- [ ] **Step 4: Aviso si el total cambia después de cobrar.** Un `useEffect` sobre `totalPyg` que, si `lineasAprobadasSinVenta()` no está vacía y el total difiere del que había al aprobar la primera línea, muestre `toast.warning("El total cambió", "Ya hay cobros aprobados por otro monto.")`.
- [ ] **Step 5: Ocultar los botones sin respaldo (hallazgo 2).** Reemplazar los `<button>` de `addExtraLeg("qr")` (paneles `qr_zimple` y `qr_cloud` de Bancard) y de `addExtraLeg("plugpay_credito")` por un `<p>` con "Para dividir con otro QR o crédito parcelado, repartí el cobro con otra tarjeta u otro método." No quitar `addExtraLeg("bancard")`, `addExtraLeg("dinelco"...)` ni `addExtraLeg("plugpay")`.
- [ ] **Step 6: Verify** — `cd ui-web && npx tsc --noEmit` sin errores; `grep -n 'addExtraLeg("qr")\|addExtraLeg("plugpay_credito")' src/pages/pos/POSPage.tsx` sin resultados.
- [ ] **Step 7: Commit** (`ui-web/src/pages/pos/POSPage.tsx`).

---

### Task 11: Panel "Revisión de cobros" (UI)

**Files:**
- Create: `ui-web/src/pages/caja/RevisionCobrosTab.tsx`
- Modify: `ui-web/src/api/index.ts` (dentro de `caja: {` ~2228), `ui-web/src/pages/caja/CajaPage.tsx` (unión `activeTab` ~176 y botón de pestaña + render)

**Interfaces:**
- Consumes: Task 4 (endpoints).
- Produces: `api.caja.revisionCobros.list(tipo: "no_cuadran" | "huerfanos" | "multi_proveedor", params?: { desde?: string; hasta?: string })` y `api.caja.revisionCobros.revisar(tipo: string, id: string)`; componente `RevisionCobrosTab` sin props.

- [ ] **Step 1: Cliente API** con los dos métodos (`client.get` / `client.post`) sobre `/v1/caja/revision-cobros`.
- [ ] **Step 2: `RevisionCobrosTab.tsx`**: tres sub-pestañas (una por tipo), tabla con los campos de la forma de cada ítem, botón "Marcar revisado" por fila (confirmación y refresco), estados de carga/vacío/error, textos en voseo, mismo estilo visual que las otras pestañas de `CajaPage`.
- [ ] **Step 3: Conectar en `CajaPage.tsx`**: agregar `"revision_cobros"` a la unión de `activeTab`, un botón de pestaña junto a los existentes (localizarlos con `grep -n '"sueldok_faltantes"' ui-web/src/pages/caja/CajaPage.tsx`), visible solo si `hasPermission("caja:revision_cobros")` con `const { hasPermission } = usePermissions()` importado de `../../context/PermissionsContext` (`CajaPage` hoy no usa permisos), y `{activeTab === "revision_cobros" && <RevisionCobrosTab />}`. Solo estas líneas en `CajaPage.tsx`.
- [ ] **Step 4: Verify** — `cd ui-web && npx tsc --noEmit` sin errores.
- [ ] **Step 5: Commit** (3 archivos).

---

### Task 12: Sandbox, despliegue y prueba real

**Files:** ninguno nuevo (verificación y despliegue).

- [ ] **Step 1: Suite completa.** `PYTHONPATH=. .venv/bin/python -m pytest api/tests/test_pagos_mixtos.py api/tests/test_revision_cobros.py -v` y `cd ui-web && node --test tests/pos/` (Node 22) → todo PASS; `npx tsc --noEmit` → sin errores.
- [ ] **Step 2: Sandbox.** Aplicar el mismo DDL al esquema `sandbox` (`psql ... -c "SET search_path TO sandbox; ..."` con solo los `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` y el `CREATE INDEX` que imprime `alembic upgrade 20261010160000:20261010170000 --sql`; **no** correr las líneas de `alembic_version` ni los `INSERT` de permisos salvo que el esquema `sandbox` tenga su propia `rbac_permissions`), reiniciar el API del sandbox con `start-sandbox.sh`, y recorrer en la UI del sandbox (`http://192.168.0.242:5174`): efectivo + QR de Bancard (confirmar que el monto generado = el registrado), débito + crédito de Bancard, doble-Enter con un cobro en curso (no debe cerrar), vaciar una venta con un cobro aprobado (debe pedir confirmación). Nunca sembrar el sandbox con datos reales de personas.
- [ ] **Step 3: Servidor a producción.** `bash deploy-api.sh` (aplica ambas migraciones y reinicia las dos instancias sin corte). Verificar: `curl -s http://127.0.0.1:8000/api/health` OK y `GET /api/v1/caja/revision-cobros?tipo=huerfanos` devuelve 401 sin token y 403 con un usuario sin el permiso.
- [ ] **Step 4: POS a producción.** `bash deploy-ui.sh`. Las cajas toman la versión al cerrar sesión; no reiniciar ninguna con una venta en curso.
- [ ] **Step 5: Prueba real**, fuera de horario, en una caja: una venta chica efectivo + QR de Bancard y otra con débito + crédito de Bancard. Confirmar en la base: `sale_payments` con `proveedor`, `referencia` y `terminal_transaction_id`; `pos_terminal_transactions.sale_id` enlazado; `sales.pagos_revision` nulo; y que el panel no lista nada nuevo.
- [ ] **Step 6: Documentar.** Agregar una nota de cierre a `docs/superpowers/specs/2026-10-10-pago-mixto-etapa1-design.md` (estado: implementado y fecha) y commitear con ruta explícita.
