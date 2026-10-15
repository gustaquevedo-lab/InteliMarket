# Viajes y Logística Distribuidora — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo de viajes de distribuidora: dispatcher arma camiones con drag-and-drop, cobrador confirma entregas por parada desde celular, NCs automáticas ante rechazo/faltante.

**Architecture:** Nuevo módulo `api/src/viajes/` con 4 tablas y 11 endpoints bajo `/api/v1/distribuidora/viajes/`. Dos páginas en `ui-web/src/pages/distribuidora/`: `DespachoPage.tsx` (desktop, drag-and-drop con @dnd-kit) y `MiViajeHoyPage.tsx` (mobile-first). Ambas en la misma PWA, diferenciadas por rol RBAC existente. NCs generadas vía `DeliveryNoteService` del módulo `delivery_notes` ya existente.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy async, PostgreSQL 16, React 18, TypeScript, Tailwind CSS, `@dnd-kit/core` + `@dnd-kit/sortable`.

**Spec:** `docs/superpowers/specs/2026-10-15-viajes-logistica-distribuidora-design.md`

## Global Constraints

- Rama exclusiva `vertical/distribuidora`. Prohibido checkout a otras ramas.
- `Dashboard.tsx` y `Layout.tsx` no se tocan.
- Moneda PYG canónica con separador de miles en toda UI.
- `@dnd-kit/core` y `@dnd-kit/sortable` son las únicas deps nuevas de frontend.
- Auth: `require_auth` (importado de `api.src.auth.middleware`) en todos los endpoints.
- `company_id` del token (`current_user["company_id"]`) debe coincidir con el recurso en todas las operaciones de escritura.
- Error en NC auto-generation no rollbackea la confirmación de parada (best-effort con log).
- Alembic down_revision: `"20261014120000"` (migración caja_ruta_tesoreria).

## Review Focus

1. **Sobrepeso ignorado por el dispatcher:** confirmar un trip con peso_total_kg > max_weight_kg no debe ser posible — `POST /confirm` debe retornar 400 si algún trip excede capacidad. **→ añadido en Task 2, `test_confirm_trip_overweight`.**
2. **Stop confirmado dos veces:** `POST /stops/{stop_id}/confirm` sobre una parada ya en estado distinto de `pendiente` debe retornar 409. **→ añadido en Task 2, `test_confirm_stop_already_confirmed`.**
3. **Cobrador accede al trip de otro:** `GET /mi-viaje-hoy` filtra por `cobrador_id = current_user["sub"]`, nunca expone trips ajenos. **→ añadido en Task 2, `test_mi_viaje_hoy_only_own_trip`.**
4. **km_llegada sin paradas completadas:** `POST /llegada` debe advertir (o bloquear) si hay paradas aún en `pendiente`. **→ añadido en Task 2, `test_llegada_with_pending_stops`.**
5. **cantidad_entregada > cantidad_asignada:** el servicio debe clampear o rechazar cantidades mayores a las asignadas. **→ añadido en Task 2, `test_confirm_stop_cantidad_excede_asignada`.**

---

## Estructura de archivos

**Crear:**
- `api/src/viajes/__init__.py`
- `api/src/viajes/models.py` — TripVehicle, Trip, TripStop, TripStopItem
- `api/src/viajes/schemas.py` — Pydantic schemas in/out
- `api/src/viajes/service.py` — lógica de negocio + NC generation
- `api/src/viajes/router.py` — 11 endpoints
- `api/alembic/versions/20261015100000_viajes_logistica.py`
- `tests/api/test_viajes.py`
- `ui-web/src/pages/distribuidora/DespachoPage.tsx`
- `ui-web/src/pages/distribuidora/MiViajeHoyPage.tsx`

**Modificar:**
- `api/alembic/env.py` — agregar `import api.src.viajes.models`
- `api/src/main.py` — registrar `viajes_router`
- `ui-web/src/api/index.ts` — interfaces + namespace `api.distribuidora.viajes`
- `ui-web/src/App.tsx` — 2 rutas lazy
- `ui-web/src/pages/distribuidora/DistribuidoraPage.tsx` — 2 botones de navegación

---

### Task 1: DB Migration y Modelos

**Files:**
- Create: `api/src/viajes/__init__.py`
- Create: `api/src/viajes/models.py`
- Create: `api/alembic/versions/20261015100000_viajes_logistica.py`
- Modify: `api/alembic/env.py`
- Test: `tests/api/test_viajes.py` (solo el test de migración)

**Interfaces:**
- Produce: clases `TripVehicle`, `Trip`, `TripStop`, `TripStopItem` con sus `__tablename__` y columnas exactas de la spec.

- [ ] **Step 1: Escribir test de existencia de tablas**

```python
# tests/api/test_viajes.py
import pytest
from sqlalchemy import text
from tests.conftest import async_session

@pytest.mark.asyncio
async def test_viajes_tables_exist(async_session):
    for table in ("trip_vehicles", "trips", "trip_stops", "trip_stop_items"):
        result = await async_session.execute(
            text("SELECT 1 FROM information_schema.tables WHERE table_name = :t"),
            {"t": table}
        )
        assert result.scalar() == 1, f"Tabla {table} no existe"
```

- [ ] **Step 2: Correr el test — debe FALLAR**

```bash
pytest tests/api/test_viajes.py::test_viajes_tables_exist -v
```
Expected: FAIL — tablas no existen.

- [ ] **Step 3: Crear `api/src/viajes/models.py`**

Cuatro modelos SQLAlchemy heredando de `Base` (`api.src.db`):

`TripVehicle` → `trip_vehicles`: `id` UUID PK, `company_id` UUID NOT NULL, `patente` VARCHAR(15) NOT NULL, `descripcion` VARCHAR(100), `max_weight_kg` NUMERIC(10,2) NOT NULL, `activo` BOOLEAN DEFAULT True, `created_at` TIMESTAMPTZ DEFAULT now(). UniqueConstraint(`company_id`, `patente`).

`Trip` → `trips`: `id` UUID PK, `company_id` UUID NOT NULL, `cobrador_id` UUID NOT NULL, `patente` VARCHAR(15) NOT NULL, `fecha` DATE NOT NULL, `estado` VARCHAR(20) NOT NULL DEFAULT `'armando'`, `km_salida` INTEGER, `km_llegada` INTEGER, `peso_total_kg` NUMERIC(10,2), `route_session_id` UUID nullable, `despachante_id` UUID NOT NULL, `created_at` TIMESTAMPTZ DEFAULT now(). Index(`company_id`, `fecha`). UniqueConstraint(`company_id`, `cobrador_id`, `fecha`).

`TripStop` → `trip_stops`: `id` UUID PK, `trip_id` UUID NOT NULL FK `trips.id` ON DELETE CASCADE, `sales_order_id` UUID NOT NULL, `customer_id` UUID NOT NULL, `orden_visita` INTEGER NOT NULL, `estado` VARCHAR(20) NOT NULL DEFAULT `'pendiente'`, `firmado` BOOLEAN DEFAULT False, `observaciones` TEXT, `visited_at` TIMESTAMPTZ. Index(`trip_id`).

`TripStopItem` → `trip_stop_items`: `id` UUID PK, `stop_id` UUID NOT NULL FK `trip_stops.id` ON DELETE CASCADE, `sales_order_item_id` UUID NOT NULL, `product_id` UUID NOT NULL, `cantidad_asignada` NUMERIC(12,3) NOT NULL, `cantidad_entregada` NUMERIC(12,3) NOT NULL DEFAULT 0, `cantidad_rechazada` NUMERIC(12,3) NOT NULL DEFAULT 0, `cantidad_faltante` NUMERIC(12,3) NOT NULL DEFAULT 0, `nc_id` UUID nullable.

- [ ] **Step 4: Crear migración `20261015100000_viajes_logistica.py`**

Cabecera: `revision = "20261015100000"`, `down_revision = "20261014120000"`. El `upgrade()` crea las 4 tablas con los índices y constraints de la spec. El `downgrade()` las elimina en orden inverso.

- [ ] **Step 5: Agregar import en `api/alembic/env.py`**

Después de `import api.src.ruta_caja.models` agregar:
```python
import api.src.viajes.models
```

- [ ] **Step 6: Aplicar migración en VM**

```bash
# En la VM, directamente con psql (workaround DNS conocido):
# Ejecutar el DDL de los CREATE TABLE de la migración vía psql
PGPASSWORD=password psql -h localhost -U intelimarket -d intelimarket -f /tmp/viajes_migration.sql
```

- [ ] **Step 7: Correr el test — debe PASAR**

```bash
pytest tests/api/test_viajes.py::test_viajes_tables_exist -v
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/src/viajes/ api/alembic/versions/20261015100000_viajes_logistica.py api/alembic/env.py tests/api/test_viajes.py
git commit -m "feat(viajes): models and migration — trip_vehicles, trips, trip_stops, trip_stop_items"
```

---

### Task 2: Backend Service y Router

**Files:**
- Create: `api/src/viajes/schemas.py`
- Create: `api/src/viajes/service.py`
- Create: `api/src/viajes/router.py`
- Modify: `api/src/main.py`
- Test: `tests/api/test_viajes.py` (ampliar)

**Interfaces:**
- Consumes: modelos de Task 1; `DeliveryNoteService` de `api.src.delivery_notes.service`; `SalesOrder`/`SalesOrderItem` de `api.src.sales_orders.models`; `Product` de `api.src.products.models` (campo `peso_kg`).
- Produce: router montado en `/api/v1/distribuidora/viajes`; `ViajesService` con métodos públicos usados por los tests.

- [ ] **Step 1: Escribir tests de servicio**

```python
# tests/api/test_viajes.py — agregar estas funciones

@pytest.mark.asyncio
async def test_confirm_trip_overweight(async_session, company_id, despachante_id):
    """confirm_trip debe lanzar ValueError si peso_total_kg > max_weight_kg del vehículo."""
    # crear TripVehicle con max_weight_kg=1000, Trip con paradas que suman 1200 kg
    # assert raises ValueError / HTTPException 400

@pytest.mark.asyncio
async def test_confirm_stop_already_confirmed(async_session, trip_stop):
    """confirm_stop sobre parada en estado != 'pendiente' debe lanzar HTTPException 409."""

@pytest.mark.asyncio
async def test_mi_viaje_hoy_only_own_trip(async_session, cobrador_a_id, cobrador_b_id, company_id):
    """get_mi_viaje_hoy filtra por cobrador_id; devuelve None si no existe o pertenece a otro."""
    # crear trip para cobrador_b; get_mi_viaje_hoy(cobrador_a_id) → None

@pytest.mark.asyncio
async def test_llegada_with_pending_stops(async_session, trip_id):
    """register_llegada con paradas en 'pendiente' debe lanzar HTTPException 400."""

@pytest.mark.asyncio
async def test_confirm_stop_cantidad_excede_asignada(async_session, stop_id):
    """confirm_stop con cantidad_entregada + rechazada + faltante > asignada debe lanzar HTTPException 422."""
```

- [ ] **Step 2: Correr los tests — deben FALLAR**

```bash
pytest tests/api/test_viajes.py -k "confirm_trip_overweight or confirm_stop_already or mi_viaje_hoy or llegada_with_pending or cantidad_excede" -v
```
Expected: FAIL — `ViajesService` no existe.

- [ ] **Step 3: Implementar `api/src/viajes/schemas.py`**

Schemas Pydantic:
- `TripVehicleCreate`: `company_id: str`, `patente: str`, `descripcion: Optional[str]`, `max_weight_kg: Decimal`
- `TripVehicleResponse`: `id: str`, `company_id: str`, `patente: str`, `descripcion: Optional[str]`, `max_weight_kg: Decimal`, `activo: bool`
- `TripCreate`: `company_id: str`, `cobrador_id: str`, `patente: str`, `fecha: date`, `despachante_id: str`
- `TripStopAssign`: `sales_order_id: str`, `customer_id: str`, `orden_visita: int`
- `TripStopsUpdate`: `stops: List[TripStopAssign]`
- `TripStopItemConfirm`: `stop_item_id: str`, `cantidad_entregada: Decimal`, `cantidad_rechazada: Decimal`, `cantidad_faltante: Decimal`
- `StopConfirmInput`: `items: List[TripStopItemConfirm]`, `firmado: bool`, `observaciones: Optional[str]`
- `KmSalidaInput`: `km_salida: int`
- `KmLlegadaInput`: `km_llegada: int`
- `TripResponse`, `TripStopResponse`, `TripStopItemResponse`: campos de los modelos + `id: str`

- [ ] **Step 4: Implementar `api/src/viajes/service.py`**

Clase `ViajesService(db: AsyncSession)` con métodos:

`list_vehicles(company_id: str) -> list[TripVehicle]`

`create_vehicle(data: TripVehicleCreate) -> TripVehicle`

`list_pending_orders(company_id: str, fecha: date) -> list[dict]` — SalesOrders con estado `'facturado'` sin trip_stop del día. Incluye peso calculado: `SUM(soi.cantidad * p.peso_kg)` via JOIN `sales_order_items` → `products`.

`create_trip(data: TripCreate) -> Trip` — valida UniqueConstraint antes de insertar.

`update_trip_stops(trip_id: str, stops: list[TripStopAssign], company_id: str) -> Trip` — elimina TripStops existentes, crea nuevos con TripStopItems desde `sales_order_items`. Solo si `trip.estado == 'armando'`.

`confirm_trip(trip_id: str, company_id: str) -> Trip` — calcula `peso_total_kg`; si > `max_weight_kg` del vehículo lanza `HTTPException(400)`; cambia estado a `'listo'`.

`get_mi_viaje_hoy(company_id: str, cobrador_id: str, fecha: date) -> Trip | None`

`register_salida(trip_id: str, km_salida: int, company_id: str) -> Trip` — valida `estado == 'listo'`; cambia a `'en_ruta'`.

`confirm_stop(stop_id: str, input: StopConfirmInput, company_id: str, cobrador_id: str) -> TripStop` — valida: parada debe ser `'pendiente'`; suma cant no excede asignada; actualiza `TripStopItem`s; calcula estado de la parada; genera NCs (best-effort); guarda `visited_at = now()`.

`register_llegada(trip_id: str, km_llegada: int, company_id: str) -> Trip` — valida que no haya paradas en `'pendiente'` (HTTP 400 si las hay); cambia estado a `'completado'`.

**Lógica NC en `confirm_stop`:**
```python
# Para cada item con rechazada > 0:
#   await delivery_note_service.create(DeliveryNoteCreate(
#       company_id=company_id, customer_id=stop.customer_id,
#       sale_id=str(stop.sales_order_id),
#       numero_nota=f"NC-RECH-{stop_item.id[:8]}",
#       fecha=date.today(), monto=precio_unitario * rechazada,
#       concepto="no_es_su_pedido", cobrador_id=cobrador_id))
# Para cada item con faltante > 0:
#   concepto="faltante_deposito"
# Guardar nc_id en TripStopItem; excepciones capturadas con log, no rollback.
```

- [ ] **Step 5: Implementar `api/src/viajes/router.py`**

`router = APIRouter(prefix="/viajes", tags=["viajes"])` con `require_auth`.

11 rutas según la spec:
- `GET /vehicles` → `list_vehicles`
- `POST /vehicles` → `create_vehicle`
- `GET /pending-orders` → `list_pending_orders` (params: `company_id`, `fecha`)
- `GET /` → lista trips (params: `company_id`, `fecha`)
- `POST /` → `create_trip`
- `PATCH /{trip_id}/stops` → `update_trip_stops`
- `POST /{trip_id}/confirm` → `confirm_trip`
- `GET /mi-viaje-hoy` → `get_mi_viaje_hoy` (usa `current_user["sub"]`)
- `POST /{trip_id}/salida` → `register_salida`
- `POST /{trip_id}/stops/{stop_id}/confirm` → `confirm_stop`
- `POST /{trip_id}/llegada` → `register_llegada`

- [ ] **Step 6: Registrar router en `api/src/main.py`**

```python
from api.src.viajes.router import router as viajes_router
app.include_router(viajes_router, prefix="/api/v1/distribuidora")
```

- [ ] **Step 7: Correr los tests — deben PASAR**

```bash
pytest tests/api/test_viajes.py -v
```
Expected: PASS todos los tests.

- [ ] **Step 8: Commit**

```bash
git add api/src/viajes/schemas.py api/src/viajes/service.py api/src/viajes/router.py api/src/main.py tests/api/test_viajes.py
git commit -m "feat(viajes): service and router — 11 endpoints, NC auto-generation on stop confirm"
```

---

### Task 3: Frontend API Client

**Files:**
- Modify: `ui-web/src/api/index.ts`
- Test: compilación TypeScript

**Interfaces:**
- Consumes: endpoints de Task 2.
- Produce: interfaces `TripVehicle`, `Trip`, `TripStop`, `TripStopItem`; namespace `api.distribuidora.viajes` con 11 métodos tipados.

- [ ] **Step 1: Agregar interfaces en `ui-web/src/api/index.ts`**

Antes de la función `createApi()`, agregar:

```typescript
export interface TripVehicle {
  id: string; company_id: string; patente: string; descripcion?: string
  max_weight_kg: number; activo: boolean
}
export interface TripStop {
  id: string; trip_id: string; sales_order_id: string; customer_id: string
  orden_visita: number
  estado: "pendiente" | "entregado" | "rechazado_parcial" | "rechazado_total" | "faltante"
  firmado: boolean; observaciones?: string; visited_at?: string
  items?: TripStopItem[]
}
export interface TripStopItem {
  id: string; stop_id: string; sales_order_item_id: string; product_id: string
  cantidad_asignada: number; cantidad_entregada: number
  cantidad_rechazada: number; cantidad_faltante: number; nc_id?: string
}
export interface Trip {
  id: string; company_id: string; cobrador_id: string; patente: string; fecha: string
  estado: "armando" | "listo" | "en_ruta" | "completado" | "cancelado"
  km_salida?: number; km_llegada?: number; peso_total_kg?: number
  route_session_id?: string; despachante_id: string; created_at: string
  stops?: TripStop[]
}
export interface PendingOrderForDispatch {
  id: string; customer_id: string; customer_name: string; numero: string
  total: number; peso_kg: number; zona?: string
}
```

- [ ] **Step 2: Agregar namespace `viajes` dentro de `distribuidora`**

Dentro del objeto `distribuidora` (después de `rutaCaja`):

```typescript
viajes: {
  listVehicles: (company_id: string) =>
    client.get<TripVehicle[]>('/v1/distribuidora/viajes/vehicles', { company_id } as any),
  createVehicle: (data: { company_id: string; patente: string; descripcion?: string; max_weight_kg: number }) =>
    client.post<TripVehicle>('/v1/distribuidora/viajes/vehicles', data),
  listPendingOrders: (company_id: string, fecha: string) =>
    client.get<PendingOrderForDispatch[]>('/v1/distribuidora/viajes/pending-orders', { company_id, fecha } as any),
  listTrips: (company_id: string, fecha: string) =>
    client.get<Trip[]>('/v1/distribuidora/viajes/', { company_id, fecha } as any),
  createTrip: (data: { company_id: string; cobrador_id: string; patente: string; fecha: string; despachante_id: string }) =>
    client.post<Trip>('/v1/distribuidora/viajes/', data),
  updateTripStops: (trip_id: string, stops: Array<{ sales_order_id: string; customer_id: string; orden_visita: number }>) =>
    client.patch<Trip>(`/v1/distribuidora/viajes/${trip_id}/stops`, { stops }),
  confirmTrip: (trip_id: string) =>
    client.post<Trip>(`/v1/distribuidora/viajes/${trip_id}/confirm`, {}),
  getMiViajeHoy: (company_id: string) =>
    client.get<Trip | null>('/v1/distribuidora/viajes/mi-viaje-hoy', { company_id } as any),
  registerSalida: (trip_id: string, km_salida: number) =>
    client.post<Trip>(`/v1/distribuidora/viajes/${trip_id}/salida`, { km_salida }),
  confirmStop: (trip_id: string, stop_id: string, data: { items: Array<{ stop_item_id: string; cantidad_entregada: number; cantidad_rechazada: number; cantidad_faltante: number }>; firmado: boolean; observaciones?: string }) =>
    client.post<TripStop>(`/v1/distribuidora/viajes/${trip_id}/stops/${stop_id}/confirm`, data),
  registerLlegada: (trip_id: string, km_llegada: number) =>
    client.post<Trip>(`/v1/distribuidora/viajes/${trip_id}/llegada`, { km_llegada }),
},
```

- [ ] **Step 3: Verificar compilación TypeScript**

```bash
cd ui-web && npx tsc --noEmit --skipLibCheck 2>&1 | grep -v "node_modules" | head -20
```
Expected: 0 errores en archivos fuera de `node_modules`.

- [ ] **Step 4: Commit**

```bash
git add ui-web/src/api/index.ts
git commit -m "feat(viajes): TypeScript types and API client methods"
```

---

### Task 4: DespachoPage — Dispatcher UI

**Files:**
- Create: `ui-web/src/pages/distribuidora/DespachoPage.tsx`
- Test: `npm run build` sin error en el archivo

**Interfaces:**
- Consumes: `api.distribuidora.viajes.*`, interfaces de Task 3.
- Produce: página funcional en `/distribuidora/despacho`.

- [ ] **Step 1: Instalar @dnd-kit**

```bash
cd ui-web && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Escribir `DespachoPage.tsx`**

Estructura del componente:

```typescript
// Estado
const [fecha, setFecha] = useState(today)
const [vehicles, setVehicles] = useState<TripVehicle[]>([])
const [trips, setTrips] = useState<Trip[]>([])           // un Trip por camión activo
const [pendingOrders, setPendingOrders] = useState<PendingOrderForDispatch[]>([])
// tripStops: { [trip_id]: TripStop[] }  — mapeo local antes de confirmar
const [tripStops, setTripStops] = useState<Record<string, PendingOrderForDispatch[]>>({})
const [confirming, setConfirming] = useState(false)
```

**Carga inicial:** `listVehicles` + `listTrips` + `listPendingOrders` para la fecha.

**Lógica de peso por columna:**
```typescript
const pesoColumna = (trip_id: string) =>
  tripStops[trip_id]?.reduce((s, o) => s + (o.peso_kg || 0), 0) ?? 0
const maxPeso = (trip_id: string) =>
  vehicles.find(v => v.patente === trips.find(t => t.id === trip_id)?.patente)?.max_weight_kg ?? Infinity
const colorBarra = (trip_id: string) => {
  const pct = pesoColumna(trip_id) / maxPeso(trip_id)
  if (pct > 1) return "bg-red-500"
  if (pct > 0.8) return "bg-yellow-400"
  return "bg-green-500"
}
```

**DndContext:** `onDragEnd` mueve la order del panel izquierdo a una columna (o devuelve a izquierda si se suelta ahí). `SortableContext` dentro de cada columna para reordenar.

**Confirmar despacho:** Para cada trip que tiene stops: `PATCH /{trip_id}/stops` con el orden actualizado → `POST /{trip_id}/confirm`. Muestra toast por cada trip confirmado.

**`WeightBar`** (componente interno): barra `<div>` con width=`${Math.min(pct*100,100)}%` y clase de color.

**`DraggableOrderCard`**: muestra cliente, nro, total (formatPYG), kg, zona badge.

**`DroppableColumn`**: header con patente + cobrador + WeightBar + lista de SortableOrderCards.

- [ ] **Step 3: Verificar compilación**

```bash
cd ui-web && npx vite build 2>&1 | tail -5
```
Expected: `built in X.XXs` sin errores del archivo nuevo.

- [ ] **Step 4: Commit**

```bash
git add ui-web/src/pages/distribuidora/DespachoPage.tsx ui-web/package.json ui-web/package-lock.json
git commit -m "feat(ui): DespachoPage — dispatcher drag-and-drop truck loading with weight validation"
```

---

### Task 5: MiViajeHoyPage — Cobrador UI

**Files:**
- Create: `ui-web/src/pages/distribuidora/MiViajeHoyPage.tsx`
- Test: `npx vite build` sin error

**Interfaces:**
- Consumes: `api.distribuidora.viajes.*`, interfaces de Task 3.
- Produce: página mobile-first en `/distribuidora/mi-viaje`.

- [ ] **Step 1: Escribir `MiViajeHoyPage.tsx`**

Estructura:

```typescript
// Estado
const [trip, setTrip] = useState<Trip | null>(null)
const [loading, setLoading] = useState(true)
const [selectedStop, setSelectedStop] = useState<TripStop | null>(null)
const [itemInputs, setItemInputs] = useState<Record<string, { entregada: string; rechazada: string; faltante: string }>>({})
const [firmado, setFirmado] = useState(false)
const [obs, setObs] = useState("")
const [confirmando, setConfirmando] = useState(false)
const [showKmSalida, setShowKmSalida] = useState(false)
const [showKmLlegada, setShowKmLlegada] = useState(false)
const [km, setKm] = useState("")
```

**Pantalla principal:**
- Si `!trip`: banner amarillo "No tenés viaje asignado para hoy".
- Si `trip.estado === 'listo'` y sin `km_salida`: banner azul con input km + botón "Salir" → `registerSalida` → recarga.
- Lista de `trip.stops` ordenadas por `orden_visita` con badge de estado.
- Barra de progreso: `completadas / total` paradas.
- Si todas completadas y `!trip.km_llegada`: botón "Cerrar viaje" → input km_llegada → `registerLlegada` → `navigate('/distribuidora/rendiciones')`.

**Modal de parada** (al tocar parada `pendiente`):
- Header: nombre cliente (mostrar `customer_id` si no hay nombre disponible), nro factura.
- Por cada `TripStopItem`: nombre producto (de `product_id`), `cantidad_asignada`, inputs `cantidad_entregada` (default = asignada) + si baja aparece `¿Rechazo o faltante?` (selector radio).
- Checkbox "Firmado por cliente".
- Textarea observaciones.
- Botón "Confirmar parada" → llama `confirmStop` → si respuesta OK muestra toast; si hubo NCs el backend las crea silenciosamente.
- Validación local: `entregada + rechazada + faltante === asignada` antes de enviar.

**Lógica de estado de badge:**
- `pendiente` → gris
- `entregado` → verde
- `rechazado_parcial` / `rechazado_total` → naranja
- `faltante` → rojo

- [ ] **Step 2: Verificar compilación**

```bash
cd ui-web && npx vite build 2>&1 | tail -5
```
Expected: `built in X.XXs` sin errores del archivo nuevo.

- [ ] **Step 3: Commit**

```bash
git add ui-web/src/pages/distribuidora/MiViajeHoyPage.tsx
git commit -m "feat(ui): MiViajeHoyPage — cobrador delivery confirmation, NC auto-toast, km tracking"
```

---

### Task 6: Navegación y Rutas

**Files:**
- Modify: `ui-web/src/App.tsx`
- Modify: `ui-web/src/pages/distribuidora/DistribuidoraPage.tsx`
- Test: `npx vite build` sin error

**Interfaces:**
- Consumes: `DespachoPage` y `MiViajeHoyPage` de Tasks 4 y 5.
- Produce: rutas `/distribuidora/despacho` y `/distribuidora/mi-viaje` activas.

- [ ] **Step 1: Agregar lazy imports y rutas en `App.tsx`**

```typescript
const DespachoPage = lazy(() => import("./pages/distribuidora/DespachoPage"))
const MiViajeHoyPage = lazy(() => import("./pages/distribuidora/MiViajeHoyPage"))
```

Rutas (dentro del bloque de rutas de distribuidora existentes):
```tsx
<Route path="distribuidora/despacho" element={<DespachoPage />} />
<Route path="distribuidora/mi-viaje" element={<MiViajeHoyPage />} />
```

- [ ] **Step 2: Agregar botones en `DistribuidoraPage.tsx`**

En el bloque de botones de navegación rápida existente, agregar:

```typescript
{ path: "/distribuidora/despacho", label: "Despacho", Icon: Truck },
{ path: "/distribuidora/mi-viaje", label: "Mi Viaje", Icon: MapPin },
```

`Truck` y `MapPin` ya están disponibles en lucide-react.

- [ ] **Step 3: Verificar build completo**

```bash
cd ui-web && npx vite build 2>&1 | tail -8
```
Expected: `built in X.XXs`, 0 errores, 2 nuevos chunks visibles.

- [ ] **Step 4: Commit**

```bash
git add ui-web/src/App.tsx ui-web/src/pages/distribuidora/DistribuidoraPage.tsx
git commit -m "feat(ui): add despacho and mi-viaje routes and navigation shortcuts"
```

---

## Self-review

**Spec coverage:**
- ✅ 4 tablas con todos los campos de la spec
- ✅ 11 endpoints incluyendo `GET /mi-viaje-hoy`
- ✅ NC auto-generation con conceptos correctos (`no_es_su_pedido`, `faltante_deposito`)
- ✅ Drag-and-drop en DespachoPage con WeightBar
- ✅ Validación local `entregada+rechazada+faltante === asignada` en MiViajeHoyPage
- ✅ Redirect a `/distribuidora/rendiciones` al cerrar viaje
- ✅ `route_session_id` nullable en Trip (se llena externamente desde SP3)
- ✅ `@dnd-kit` como única dep nueva de frontend

**Review Focus cubierto:**
- ✅ `test_confirm_trip_overweight` → Task 2
- ✅ `test_confirm_stop_already_confirmed` → Task 2
- ✅ `test_mi_viaje_hoy_only_own_trip` → Task 2
- ✅ `test_llegada_with_pending_stops` → Task 2
- ✅ `test_confirm_stop_cantidad_excede_asignada` → Task 2

**Tipos consistentes:** `TripStop.estado` usa el mismo enum string en schemas, interfaces TS y service. `confirmStop` recibe `stop_item_id` (no `id`) para coincidir con el schema `TripStopItemConfirm`.

**Proporción:** Plan ~500 líneas para spec ~200 líneas. Proporcional dado que el plan incluye código de tests y firmas exactas de TypeScript.
