# Motor de actividades de proveedor — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar en el pedido del preventista las actividades de proveedor (escala % y bonificación), auditarlas en el servidor con retención para aprobación, consumir el presupuesto y rendir al proveedor (informe, cuenta a cobrar, asiento).

**Architecture:** Módulo nuevo `api/src/actividades/` con una función pura `evaluar()` (Python) espejada en `inteliforce/lib/actividades.ts`; un archivo de casos compartido prueba las dos. El servidor es la autoridad: recalcula en `POST /inteliforce/orders` y retiene si difiere. Hasta el corte las actividades vienen del legacy por `sync_incremental.py`.

**Tech Stack:** FastAPI + SQLAlchemy async + Postgres (DDL en `scripts/migrate.py`, sin alembic), pytest, Expo/React Native + expo-sqlite, React/TS (ui-web), openpyxl (ya usado en `api/src/accounts_receivable/export_service.py`).

**Spec:** `docs/superpowers/specs/2026-10-26-actividades-proveedor-design.md` (leerla antes de empezar).

## Global Constraints

- Rama `vertical/distribuidora`. La VM de desarrollo (minisforum-ia) es la fuente de verdad: antes de empezar, confirmar que el checkout local coincide con la VM y GitHub (`git fetch && git status`, y `git log -1` en la VM). Commit **y push** apenas se verifica cada tarea.
- Montos en Gs: enteros. Todo cálculo usa `api/src/common/money.py` (`gs` hacia arriba, `iva_incluido` al más próximo) y `ui-web/src/utils/money.ts` / su equivalente en la app. Nunca `ROUND_CEILING` ni `/11` `/21` sueltos: `api/tests/test_money.py` falla.
- `COMPANY_ID` Casa Gonzalito = `00000000-0000-0000-0000-000000000010`.
- DDL idempotente en `scripts/migrate.py` (`CREATE TABLE IF NOT EXISTS`, entradas en `COLUMN_MIGRATIONS`, índices en `INDEX_DDL`).
- Nunca consultas pesadas al MySQL de producción `192.168.1.103`. Para explorar, la copia local: `ssh intellihouse@minisforum-ia 'mysql -u etl -petl columbia -e "..."'` (datos hasta 22-jul-2026).
- Reinicio del API: primero `api-2` (:8010), luego `api` (:8000), salud en `/api/health`. Nunca `scripts/restart_api.sh`. Una variable nueva en `.env` debe declararse en `config.py`.
- No tocar `api/src/promotions/` (es del supermercado).
- Fechas visibles en America/Asuncion.
- Modo ponytail: nada fuera de la spec. Lo que la spec deja afuera queda afuera.

## Review Focus

1. Escala con productos de **distinto precio** en el mismo alcance: el % se aplica a cada línea con su precio y el descuento unitario se redondea hacia arriba por línea (no sobre el total).
2. **Dos actividades** sobre la misma línea: gana la de mayor descuento de esa línea; empate, la que vence antes. Nunca se suman.
3. **Reenvío** del mismo pedido (`client_op_id` repetido): no duplica aplicaciones ni consume dos veces el presupuesto.
4. **Presupuesto justo en el límite** con dos pedidos simultáneos: solo uno pasa sin retención (`SELECT ... FOR UPDATE`).
5. **Anulación** de una venta con actividades: devuelve el consumo y borra las aplicaciones.

Cada uno tiene su prueba en la tarea dueña (marcadas **[RF1]**…**[RF5]**).

---

### Task 1: Esquema y modelos

**Files:**
- Modify: `scripts/migrate.py` (nuevo bloque `ACTIVIDADES_DDL`, ejecutarlo en `main()` después de `PLATFORM_DDL`; `COLUMN_MIGRATIONS`; `INDEX_DDL`)
- Create: `api/src/actividades/__init__.py`, `api/src/actividades/models.py`
- Test: `api/tests/test_actividades_models.py`

**Interfaces:**
- Produces: modelos `Actividad`, `ActividadTramo`, `ActividadAplicacion`, `ActividadRendicion` con las columnas de la spec §1; columnas `sale_items.actividad_id`, `products.unidades_por_caja`, `products.division_id`, `supplier_credit_notes.rendicion_id`, `credit_approval_requests.motivo` (text, default `'credito'`), `credit_approval_requests.detalle` (jsonb).

- [ ] **Step 1: Test que falla**

```python
def test_tablas_actividades():
    from api.src.actividades.models import Actividad, ActividadTramo, ActividadAplicacion, ActividadRendicion
    assert Actividad.__tablename__ == "actividades"
    assert {"presupuesto", "consumido", "valoriza_bonificacion", "alcance", "alcance_ids", "legacy_id"} <= set(Actividad.__table__.c.keys())
    assert ActividadTramo.__tablename__ == "actividad_tramos"
    assert ActividadAplicacion.__tablename__ == "actividad_aplicaciones"
    assert ActividadRendicion.__tablename__ == "actividad_rendiciones"
```

- [ ] **Step 2:** `pytest api/tests/test_actividades_models.py -v` → FAIL (módulo no existe).
- [ ] **Step 3:** Escribir modelos y `ACTIVIDADES_DDL` (mismas columnas y tipos; único `(company_id, legacy_id)` en actividades y `(company_id, supplier_id, ciclo)` en rendiciones; índices `actividad_aplicaciones(actividad_id)`, `(sale_id)`). En el mismo DDL: `ALTER TABLE credit_approval_requests ALTER COLUMN credit_account_id DROP NOT NULL;` y reflejarlo en `credit_accounts/models.py` (`nullable=True`). Agregar columnas a `COLUMN_MIGRATIONS` y a los modelos SQLAlchemy existentes (`SaleItem`, `Product`, `SupplierCreditNote`, `CreditApprovalRequest`).
- [ ] **Step 4:** `pytest api/tests/test_actividades_models.py api/tests/test_imports.py -v` → PASS.
- [ ] **Step 5:** En la VM: `DATABASE_URL=... uv run python scripts/migrate.py` dos veces (idempotente; la segunda solo muestra ✓). Commit + push: `feat(actividades): tablas y columnas del motor de actividades`.

---

### Task 2: Motor puro `evaluar()` y casos compartidos

**Files:**
- Create: `api/src/actividades/engine.py`, `api/tests/fixtures/actividades_casos.json`
- Test: `api/tests/test_actividades_engine.py`

**Interfaces:**
- Produces:
  - `evaluar(lineas: list[dict], actividades: list[dict]) -> list[dict]`
  - entrada línea: `{"product_id": str, "cantidad": Decimal, "precio": Decimal, "costo": Decimal|None}`
  - entrada actividad: `{"id": str, "tipo": "escala"|"bonificacion", "producto_ids": [str], "vigente_hasta": "YYYY-MM-DD", "saldo": Decimal, "valoriza": "lista"|"costo", "tramos": [{"desde": Decimal, "porcentaje": Decimal|None, "cada": Decimal|None, "bonifica": Decimal|None, "producto_bonificado_id": str|None, "tope": Decimal|None}]}`
  - salida: una entrada por línea original `{"product_id", "actividad_id"|None, "descuento_unitario": Decimal, "bonificada": False}` más una por cada línea bonificada `{"product_id", "actividad_id", "cantidad", "descuento_unitario": 0, "bonificada": True, "valor": Decimal}`; cada línea con descuento lleva también `"valor"` (= descuento_unitario × cantidad).
  - No mira saldo (eso es la auditoría, Task 5). Usa `gs()` de `api/src/common/money.py`.

- [ ] **Step 1: Casos** en `actividades_casos.json` (lista de `{"nombre", "lineas", "actividades", "esperado"}`), como mínimo:
  - `escala_cumple`: MARILAN 5% desde 20; líneas 12×16884 y 8×5200 → unitarios 845 y 260.
  - `escala_no_cumple`: mismas con 11+8=19 → sin actividad.
  - `escala_tramo_mayor`: tramos 20→5% y 50→8%; 60 unidades → 8%.
  - `bonificacion_tope`: cada 10, 1 gratis, tope 5; 34 → 3 bonificadas; 80 → 5.
  - `bonificacion_valor_costo`: valoriza=costo, costo 4000, 3 bonificadas → valor 12000.
  - **[RF1]** `escala_precios_distintos_redondeo`: precio 16884 × 5% = 844,2 → 845 por unidad (no sobre el total).
  - **[RF2]** `dos_actividades_misma_linea`: 5% vs 8% sobre el mismo producto → gana 8%; con 5% vs 5% → gana la de `vigente_hasta` menor.
- [ ] **Step 2: Test** que recorre el JSON:

```python
import json, pathlib
from decimal import Decimal
from api.src.actividades.engine import evaluar
CASOS = json.loads((pathlib.Path(__file__).parent / "fixtures/actividades_casos.json").read_text(), parse_float=Decimal)

import pytest
@pytest.mark.parametrize("caso", CASOS, ids=[c["nombre"] for c in CASOS])
def test_caso(caso):
    assert json.loads(json.dumps(evaluar(caso["lineas"], caso["actividades"]), default=str), parse_float=Decimal) == caso["esperado"]
```
  (Normalizar Decimals a string en `esperado` si hace falta; lo importante es que el mismo JSON lo lea la app en Task 8.)
- [ ] **Step 3:** `pytest api/tests/test_actividades_engine.py -v` → FAIL.
- [ ] **Step 4:** Implementar `evaluar` (spec §2): por actividad, base = suma de cantidades de líneas con `product_id` en `producto_ids`; escala → mayor tramo con `desde ≤ base` → `gs(precio × pct / 100)` por línea; bonificación → `floor(base / cada) × bonifica`, `min(tope)`; por línea quedarse con la de mayor descuento (empate: `vigente_hasta` menor).
- [ ] **Step 5:** `pytest api/tests/test_actividades_engine.py api/tests/test_money.py -v` → PASS. Commit + push.

---

### Task 3: Descuento unitario en la venta

**Files:**
- Modify: `api/src/sales/schemas.py` (`SaleItemInput`), `api/src/sales/service.py` (`calculate_taxes` ~línea 81 y el armado de `SaleItem` ~línea 547)
- Test: `api/tests/test_sales_tax.py` (agregar)

**Interfaces:**
- Produces: `SaleItemInput.descuento_unitario: Decimal = 0`, `SaleItemInput.actividad_id: UUID | None = None`. Si `descuento_unitario > 0`: `descuento_monto = descuento_unitario × cantidad` (ignora `descuento_pct`). `SaleItem.actividad_id` se graba.

- [ ] **Step 1: Test que falla:** 12 × 16884 con `descuento_unitario=845`, IVA 10 → `descuento_monto == 10140`, `total == 192468`, `iva_monto == iva_incluido(192468, 10) == 17497`.
- [ ] **Step 2:** `pytest api/tests/test_sales_tax.py -v` → FAIL.
- [ ] **Step 3:** Implementar (una rama en `calculate_taxes`; pasar `actividad_id` al `SaleItem`).
- [ ] **Step 4:** `pytest api/tests/test_sales_tax.py api/tests/test_money.py -v` → PASS. Commit + push.

---

### Task 4: Consumo y devolución del presupuesto

**Files:**
- Create: `api/src/actividades/service.py`
- Modify: `api/src/sales/service.py` (`create_sale`: al final, si `sale.estado != "pendiente_aprobacion"` llamar `consumir`; `cancel_sale` ~línea 1545: llamar `liberar`)
- Test: `api/tests/test_actividades_service.py`

**Interfaces:**
- Produces:
  - `async def consumir(db, sale) -> None`: por cada `SaleItem` con `actividad_id`, inserta `ActividadAplicacion` (valor = `descuento_monto`, o para bonificadas el valor según `valoriza_bonificacion` de la actividad) y suma a `actividades.consumido` con `select(...).with_for_update()`. Idempotente: si ya hay aplicaciones de ese `sale_id`, no hace nada.
  - `async def liberar(db, sale_id) -> None`: resta lo consumido y borra las aplicaciones.
  - `async def saldo(db, actividad_id) -> Decimal` (presupuesto − consumido).

- [ ] **Step 1: Tests que fallan** (mock db al estilo de `api/tests/test_ruta_caja_service.py`):
  - `consumir` agrega una aplicación por línea con actividad y suma al consumido.
  - **[RF3]** llamar `consumir` dos veces para la misma venta no duplica.
  - **[RF5]** `liberar` resta y borra.
  - **[RF4]** `consumir` usa `with_for_update()` sobre la actividad (verificar en la query construida).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** `pytest api/tests/test_actividades_service.py -v` → PASS. Commit + push.

---

### Task 5: Endpoint del celular y auditoría del pedido

**Files:**
- Modify: `api/src/inteliforce/router.py` (nuevo `GET /actividades`; en `create_order` línea ~131 aplicar auditoría), `api/src/inteliforce/schemas.py` (`MobileOrderItem`: `actividad_id: uuid.UUID | None = None`, `descuento_unitario: Decimal = 0`, `bonificada: bool = False`)
- Modify: `api/src/actividades/service.py` (`vigentes`, `auditar`)
- Test: `api/tests/test_actividades_auditoria.py`

**Interfaces:**
- Consumes: `evaluar` (Task 2), `saldo` (Task 4), `SaleItemInput.descuento_unitario/actividad_id` (Task 3).
- Produces:
  - `async def vigentes(db, company_id, hoy) -> list[dict]` en el formato de entrada de `evaluar`, con `producto_ids` resuelto (alcance proveedor → productos con ese `supplier_id`; división → `division_id`) y `saldo`.
  - `def auditar(celular: list[dict], servidor: list[dict], saldos: dict[str, Decimal]) -> list[dict]`: devuelve las diferencias `{"product_id", "motivo", "celular", "servidor"}` con motivos `descuento_distinto`, `actividad_vencida`, `presupuesto_insuficiente`, `bonificada_sin_derecho`, `descuento_sin_actividad`. Lista vacía = pasa.
- Comportamiento en `create_order`: el precio sigue saliendo del servidor (Precio 1). Se calcula `servidor = evaluar(...)`; si `auditar` da vacío, las líneas van con el descuento del servidor; si no, van **con lo del celular** (es lo que vio el cliente), la venta se crea con `estado="pendiente_aprobacion"` y se crea/actualiza el pedido de aprobación (Task 6) con `motivo` que incluya `actividades` y `detalle` = diferencias. Las líneas bonificadas se agregan como `SaleItemInput` con `precio_unitario` de lista y `descuento_unitario` = precio (total 0) y `actividad_id`.

- [ ] **Step 1: Tests que fallan** de `auditar` (función pura): igual → `[]`; descuento distinto; actividad que el servidor ya no tiene → `actividad_vencida`; saldo menor que el valor → `presupuesto_insuficiente`; línea `bonificada` que el servidor no genera; descuento con `actividad_id` nulo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar `vigentes`, `auditar`, el endpoint y el cambio en `create_order` (quitar el comentario `shortcut: ... ni actividades de proveedor`).
- [ ] **Step 4:** `pytest api/tests/test_actividades_auditoria.py api/tests/test_actividades_engine.py -v` → PASS. Commit + push.

---

### Task 6: Cola de aprobación con motivo "actividades"

**Files:**
- Modify: `api/src/credit_accounts/service.py` (`create_approval_request` acepta `motivo`, `detalle`, `credit_account_id=None`; si ya existe uno para el `sale_id` —es único— suma el motivo y el detalle), router de aprobaciones del mismo módulo (nueva acción de resolución para actividades)
- Modify: `api/src/sales/service.py` línea ~649 (pasar `motivo="credito"`)
- Test: `api/tests/test_actividades_aprobacion.py`

**Interfaces:**
- Produces: `POST /credit-accounts/approvals/{id}/actividades` con body `{"accion": "aprobar"|"corregir"|"rechazar"}` y permiso `aprobar_actividades` (una firma; el crédito conserva su doble firma). `aprobar` → venta confirmada con los descuentos del celular y `consumir()`. `corregir` → reemplaza descuento/actividad de las líneas por lo del servidor (recalcular totales con `calculate_taxes`), confirma y `consumir()`. `rechazar` → `cancel_sale`. Si el pedido además tiene motivo `credito` pendiente, la venta no se confirma hasta resolver los dos.
- Ubicar el permiso igual que los existentes (grep `aprobar_credito` o similar en `api/src/auth`).

- [ ] **Step 1: Tests que fallan:** crear pedido de aprobación sin `credit_account_id`; segundo motivo sobre el mismo `sale_id` se fusiona; `corregir` deja los descuentos del servidor; con crédito pendiente no confirma.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (+ `pytest api/tests -k "credit or actividades" -v`). Commit + push.

---

### Task 7: Sync de actividades del legacy

**Files:**
- Modify: `scripts/migracion_casa_gonzalito/sync_incremental.py` (nueva `sync_actividades(pg, my)`, llamada en el `main` después de `sync_productos`; en `sync_productos` traer `CANT_CAJA` → `products.unidades_por_caja`)

**Interfaces:**
- Consumes: tablas de Task 1. Mismos UUID deterministas del archivo (`uuid5(NS, ...)`): actividad = `uuid5(NS, f"actividad:{ID}")`, tramo = `uuid5(NS, f"actividad_tramo:{item_act.ID}")`; productos y proveedores con las funciones que ya usa el archivo.
- Mapeo (solo `CICLO >= ciclo actual - 1`, consultas acotadas por `CICLO`, indexado):
  - `TIPOACT 2` → `escala`; `TIPOACT 1` → `bonificacion`; 3 y 4 se saltean (log).
  - `item_act DC=1` → tramo (`CANTVEND` = desde, `CANTBONI` = porcentaje o bonifica según tipo, `LIMITE` = tope). Si `ATTRIB & 8`: `desde × CANT_CAJA` del producto del tramo.
  - `item_act DC=0` → `alcance = productos`, `alcance_ids` = esos productos.
  - Proveedor = el `ID_PROVEEDOR` del producto del tramo. `presupuesto = PRESUPUESTO`, `vigente_desde/hasta = FECINI/FECFIN`, `activa = INACTIVO=0 AND SUPERADO=0`, `cuenta_contable = CODICUENT`, `valoriza_bonificacion = lista`.
  - **No** pisar `consumido` (lo maneja InteliMarket).

- [ ] **Step 1:** Probar primero contra la copia local (`mysql -u etl -petl columbia` en minisforum, apuntando el script con una variable de entorno de host si ya existe; si no, correr la consulta de lectura a mano) y comparar 3 actividades reales (una de cada tipo, p. ej. IDs 22861, 22931, 22167) campo por campo con lo cargado en Postgres.
- [ ] **Step 2:** Validar el supuesto `ATTRIB & 8` = meta en cajas con esas 3 (ver cantidades vendidas reales en `item_ventas` con su `ACTIV`). Si no se confirma, dejar `desde` sin multiplicar y anotarlo en la spec.
- [ ] **Step 3:** Correr el sync real en la VM una vez a mano; verificar conteo de actividades vigentes (~190 por ciclo). Commit + push.

---

### Task 8: App Inteliforce

**Files:**
- Create: `inteliforce/lib/actividades.ts` (espejo de `evaluar`), `inteliforce/lib/actividades.test.ts`
- Modify: `inteliforce/lib/offline/db.ts` (tabla `cached_actividades` igual que `cached_catalog`; `saveActividades`/`getActividades`), `inteliforce/lib/api.ts` (`GET /inteliforce/actividades`), `inteliforce/app/(vendedor)/pedido/index.tsx` (bajar y cachear junto al catálogo), `inteliforce/components/pedido/CartItem.tsx` y `CartSummary.tsx` (precio final, nombre de la actividad, línea bonificada a ₲0, "faltan N unidades para X%"), `inteliforce/app/(vendedor)/pedido/confirmar.tsx` (mandar `actividad_id`, `descuento_unitario`, `bonificada` por línea)

**Interfaces:**
- Consumes: formato de `GET /inteliforce/actividades` (Task 5) y `api/tests/fixtures/actividades_casos.json` (Task 2).
- Produces: `export function evaluar(lineas, actividades)` con la misma salida que Python. Redondeo: `Math.ceil` para el descuento unitario (mismo criterio que `gs`).

- [ ] **Step 1: Test** `actividades.test.ts` con `node:assert` que lee `../api/tests/fixtures/actividades_casos.json` y compara cada caso.
- [ ] **Step 2:** `cd inteliforce && npx --yes tsx lib/actividades.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `evaluar` y las pantallas.
- [ ] **Step 4:** test → PASS; `npx tsc --noEmit` sin errores nuevos. Commit + push. (El APK lo genera el usuario localmente.)

---

### Task 9: Rendición

**Files:**
- Create: `api/src/actividades/rendicion.py`, `api/src/actividades/router.py` (registrar en `api/src/main.py` junto a los demás `include_router`)
- Modify: `api/src/financial/service.py` (`create_supplier_credit_note` ~línea 2814 y su schema: aceptar `rendicion_id`; si viene, sumar a `cobrado` de la rendición y pasar a `parcial`/`cobrada`; contabilizar contra "Reintegros a cobrar a proveedores", no como ingreso)
- Test: `api/tests/test_actividades_rendicion.py`

**Interfaces:**
- Produces:
  - `GET /actividades/rendicion?supplier_id=&ciclo=` → Excel (openpyxl, mismo estilo que `accounts_receivable/export_service.py`): hoja "Resumen" por actividad y hoja "Detalle" por factura, desde `actividad_aplicaciones` ⋈ `sales`.
  - `POST /actividades/rendiciones` `{supplier_id, ciclo}` → crea `ActividadRendicion(monto = suma de valor)` y el asiento con dos llamadas a `integrated_finance.service.post_accounting_entry` (mismo `asiento_numero`; Debe cuenta "Reintegros a cobrar a proveedores", Haber `cuenta_contable` de la actividad, agrupando por cuenta). Error 409 si ya existe para ese proveedor y ciclo.
  - `GET /actividades` (lista con filtros ciclo/proveedor) y `GET /actividades/{id}` para la pantalla.
- Antes de implementar: confirmar en `account_plans` de Casa Gonzalito que exista la cuenta de reintegros; si no, crearla con el endpoint existente (anotar el código usado en la spec).

- [ ] **Step 1: Tests que fallan:** monto de la rendición = suma de aplicaciones del proveedor y ciclo; segunda rendición igual → 409; nota de crédito con `rendicion_id` por menos → `parcial`, por el total → `cobrada`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. Commit + push.

---

### Task 10: Pantallas web

**Files:**
- Create: `ui-web/src/pages/actividades/ActividadesPage.tsx` (lista de actividades del ciclo con consumido/presupuesto; pestaña "Rendición": elegir proveedor y ciclo, descargar Excel, botón "Cerrar rendición", lista de rendiciones con estado)
- Modify: `ui-web/src/App.tsx` y `ui-web/src/components/Layout.tsx` (ruta y menú en la sección Distribuidora; el menú real sale de `tenants.config`, verificarlo ahí), pantalla existente de aprobaciones de crédito (mostrar `motivo` y la tabla de `detalle` celular vs servidor, y los botones aprobar/corregir/rechazar para actividades), formulario de nota de crédito de proveedor (selector de rendición pendiente)
- Montos con `ui-web/src/utils/money.ts`.

- [ ] **Step 1:** Implementar. **Step 2:** `cd ui-web && npm run build` sin errores. **Step 3:** Verificar en el navegador (preview) la lista, la descarga y la cola con un pedido retenido de prueba. Commit + push.

---

### Task 11: Despliegue y prueba de punta a punta

- [ ] **Step 1:** En la VM: `migrate.py`, reinicio `api-2` → `api`, `deploy-ui.sh`, salud OK.
- [ ] **Step 2:** Sync de actividades manual (Task 7) y comprobar vigentes en `GET /inteliforce/actividades`.
- [ ] **Step 3:** Pedido de prueba por la API como preventista con una actividad de escala que cumple → venta confirmada, descuento correcto, aplicación grabada, `consumido` sube. Mismo pedido con un descuento alterado → retenido con motivo; resolver con `corregir`. Anular la venta → `consumido` vuelve.
- [ ] **Step 4:** Rendición del ciclo de prueba: Excel, cierre, asiento visible, nota de crédito que la cancela.
- [ ] **Step 5:** Borrar los datos de prueba (ventas, aplicaciones, rendición, asiento) o hacerlo en el schema `sandbox`. Actualizar `docs/ROADMAP-DISTRIBUIDORA.md` y la memoria del roadmap. Commit + push.
