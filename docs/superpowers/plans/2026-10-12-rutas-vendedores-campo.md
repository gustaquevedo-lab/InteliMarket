# Rutas y Vendedores de Campo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el mapa en tiempo real de MapLibre a Google Maps JS API y agregar geocodificación de clientes, visualización de rutas planeadas, UI de optimización de ruta (TSP) y pantalla de rendimiento de preventistas.

**Architecture:** Tres capas en Google Maps (polylines de rutas + markers de clientes con estado + markers de vendedores en tiempo real). Dos nuevos endpoints REST para datos del mapa y uno para rendimiento. El endpoint TSP ya existe en backend; solo se agrega la UI. La geocodificación se corre como script batch una sola vez + updates online vía endpoint existente.

**Tech Stack:** Python/FastAPI, SQLAlchemy async, Alembic, React 18, TypeScript, `@react-google-maps/api ^2.20`, `@googlemaps/markerclusterer ^2`

**Spec:** `docs/superpowers/specs/2026-10-12-rutas-vendedores-campo-design.md`

## Global Constraints

- `extra='forbid'` en `Settings`: toda variable de entorno nueva debe declararse en `api/src/config.py` antes de usarla.
- `google_maps_api_key` ya declarado en `config.py` (commit `0e9b3798`). `VITE_GOOGLE_MAPS_KEY` va solo en `ui-web/.env.local` del servidor — no en git.
- Patrón de tests backend: pytest + AsyncSession + sin httpx client (ver `api/tests/test_intelientregas.py`).
- `company_id` de Gonzalito: `"00000000-0000-0000-0000-000000000010"`.
- Colores de rutas: 10 fijos en orden: `["#ef4444","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6","#8b5cf6","#ec4899","#64748b","#0ea5e9"]`, indexado por `route_index % 10`.
- RendimientoPage existente (`pages/rendimiento/RendimientoPage.tsx`) es supermercado-specific. NO modificarla. Nueva página en `pages/distribuidora/RendimientoVendedoresPage.tsx`.
- Patrón API client: añadir en `ui-web/src/api/index.ts`, dentro del objeto `distribuidora` (línea ~3873). Seguir el estilo `client.get<T>(url, params)`.
- Depósito Gonzalito (origen de todas las rutas): `lat: -25.3235, lng: -57.5641`.

## Review Focus

1. **Clientes sin lat/lng** — el endpoint `map/customers` filtra `lat IS NOT NULL`; si ningún cliente tiene coordenadas aún (antes de correr el geocode script), el mapa debe mostrar estado vacío explicativo, no romper.
2. **Google Maps key ausente en frontend** — si `VITE_GOOGLE_MAPS_KEY` está vacío, `useJsApiLoader` falla silenciosamente; `MapaPage` debe mostrar un mensaje de error visible en lugar de spinner infinito.
3. **Ruta sin instancia activa hoy** — `map/routes` filtra por rutas con instancia del día; si no hay ninguna, debe devolver `[]` sin error 500.
4. **Optimización con < 2 clientes GPS** — el backend ya lanza `HTTPException(400, ...)` en ese caso; la UI debe mostrar ese mensaje en un toast de error, no una pantalla rota.
5. **Vendedor con 0 paradas completadas** — `coverage_pct` y `conversion_rate` deben ser `0.0`, no `NaN` (división por cero).

---

## File Map

| Archivo | Acción | Tarea |
|---|---|---|
| `api/alembic/versions/XXXX_geocoords_customers.py` | crear | T1 |
| `scripts/geocode_customers.py` | crear | T2 |
| `api/src/distribuidora/service.py` | modificar — agregar 3 funciones | T3, T4 |
| `api/src/distribuidora/router.py` | modificar — agregar 3 rutas GET | T3, T4 |
| `api/tests/test_distribuidora_map.py` | crear | T3 |
| `api/tests/test_distribuidora_performance.py` | crear | T4 |
| `ui-web/package.json` | modificar — 2 deps | T5 |
| `ui-web/src/api/index.ts` | modificar — métodos `map.*` y `sellers.performance` | T5 |
| `ui-web/src/pages/mapa-tiempo-real/MapaPage.tsx` | reescribir | T6 |
| `ui-web/src/pages/rutas/RutasPage.tsx` | modificar — botón optimizar | T7 |
| `ui-web/src/pages/distribuidora/RendimientoVendedoresPage.tsx` | crear | T8 |
| `ui-web/src/App.tsx` | modificar — lazy import + ruta | T8 |

---

## Task 1: DB Migration — geocoords en customers

**Files:**
- Create: `api/alembic/versions/XXXX_geocoords_customers.py`

**Interfaces:**
- Produces: columnas `lat NUMERIC(10,8)`, `lng NUMERIC(11,8)`, `geocoded_at TIMESTAMPTZ` en tabla `customers`, todas nullable.

- [ ] **Step 1: Generar la revisión Alembic**

```bash
cd api && alembic revision --autogenerate -m "add geocoords to customers"
```

- [ ] **Step 2: Verificar el archivo generado**

Confirmar que contiene `op.add_column` para las tres columnas (puede que autogenerate no las detecte si el modelo ORM no fue actualizado — en ese caso escribirlas manualmente):

```python
op.add_column('customers', sa.Column('lat', sa.Numeric(10, 8), nullable=True))
op.add_column('customers', sa.Column('lng', sa.Numeric(11, 8), nullable=True))
op.add_column('customers', sa.Column('geocoded_at', sa.DateTime(timezone=True), nullable=True))
```

Y el `downgrade`:
```python
op.drop_column('customers', 'geocoded_at')
op.drop_column('customers', 'lng')
op.drop_column('customers', 'lat')
```

- [ ] **Step 3: Actualizar el modelo ORM de customers**

En el modelo ORM correspondiente a `customers` (buscar con `grep -n "class Customer" api/src`), agregar:
```python
lat: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 8), nullable=True)
lng: Mapped[Optional[Decimal]] = mapped_column(Numeric(11, 8), nullable=True)
geocoded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 4: Correr la migración**

```bash
cd api && alembic upgrade head
```

Expected: `Running upgrade ... -> XXXX, add geocoords to customers`

- [ ] **Step 5: Verificar en DB**

```bash
psql $DATABASE_URL -c "\d customers" | grep -E "lat|lng|geocoded_at"
```

Expected: tres filas con `numeric` / `timestamp with time zone`.

- [ ] **Step 6: Commit**

```bash
git add api/alembic/versions/ api/src/
git commit -m "feat(db): agregar columnas lat/lng/geocoded_at en customers"
```

---

## Task 2: Script de geocodificación batch

**Files:**
- Create: `scripts/geocode_customers.py`

**Interfaces:**
- Consumes: columnas `lat`, `lng`, `geocoded_at` de T1; `settings.google_maps_api_key` de config.
- Produces: clientes de Gonzalito con `lat` y `lng` poblados en DB.

- [ ] **Step 1: Crear `scripts/geocode_customers.py`**

Estructura del script:
```python
#!/usr/bin/env python3
"""Geocodifica clientes de una empresa usando Google Geocoding API.
Uso: python scripts/geocode_customers.py --company-id 00000000-0000-0000-0000-000000000010
"""
import argparse, asyncio, time
import httpx
from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

# Conectar a DB desde DATABASE_URL env
# Seleccionar customers donde company_id = arg Y (lat IS NULL OR geocoded_at IS NULL)
# Para cada cliente: query = f"{row.direccion}, {row.ciudad}, Paraguay"
# GET https://maps.googleapis.com/maps/api/geocode/json?address={query}&key={API_KEY}
# Si status == "OK": UPDATE lat, lng, geocoded_at = now()
# Rate limit: time.sleep(0.02) entre requests (50 req/s)
# Al final: loguear cuántos quedaron sin geocodificar
```

Manejo de errores:
- `ZERO_RESULTS`: marcar `geocoded_at = now()` con `lat=NULL` (para no reintentar indefinidamente)
- Timeout / red: reintentar hasta 3 veces con backoff exponencial (1s, 2s, 4s)

- [ ] **Step 2: Probar en seco con `--dry-run`**

Agregar flag `--dry-run` que imprime las direcciones que procesaría sin escribir a DB.

```bash
python scripts/geocode_customers.py \
  --company-id 00000000-0000-0000-0000-000000000010 \
  --dry-run
```

Expected: lista de clientes con sus direcciones, sin cambios en DB.

- [ ] **Step 3: Correr geocodificación real (en el servidor)**

```bash
python scripts/geocode_customers.py \
  --company-id 00000000-0000-0000-0000-000000000010
```

Expected: `Geocodificados: N clientes. Sin resultado: M.`

- [ ] **Step 4: Verificar cobertura**

```bash
psql $DATABASE_URL -c "
  SELECT COUNT(*) FILTER (WHERE lat IS NOT NULL) AS con_coords,
         COUNT(*) FILTER (WHERE lat IS NULL) AS sin_coords
  FROM customers WHERE company_id = '00000000-0000-0000-0000-000000000010';
"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/geocode_customers.py
git commit -m "feat(scripts): geocodificación batch de clientes con Google Geocoding API"
```

---

## Task 3: Backend — endpoints del mapa

**Files:**
- Modify: `api/src/distribuidora/service.py` — agregar `get_map_routes()` y `get_map_customers()`
- Modify: `api/src/distribuidora/router.py` — agregar 2 rutas GET
- Create: `api/tests/test_distribuidora_map.py`

**Interfaces:**
- Consumes: T1 (columnas lat/lng en customers).
- Produces:
  - `get_map_routes(db: AsyncSession, company_id: str) -> list[dict]`
  - `get_map_customers(db: AsyncSession, company_id: str) -> list[dict]`
  - `GET /api/v1/distribuidora/map/routes/{company_id}`
  - `GET /api/v1/distribuidora/map/customers/{company_id}`

Esquema de respuesta de `get_map_routes`:
```python
{
  "route_id": str,
  "route_name": str,
  "seller_name": str | None,
  "seller_id": str | None,
  "color_index": int,          # índice 0-9 en el array de colores del spec
  "waypoints": [               # ordenados por visit_order ASC
    {
      "customer_id": str,
      "razon_social": str,
      "lat": float | None,
      "lng": float | None,
      "visit_order": int,
      "visit_status": str | None,  # "visited_order"|"visited_no_order"|"pending"|"missed"
    }
  ],
  "depot_lat": -25.3235,
  "depot_lng": -57.5641,
  "is_optimized": bool
}
```

`visit_status` se calcula desde `route_stops` de la instancia del día:
- stop.status == "completed" AND stop.order_amount > 0 → `"visited_order"`
- stop.status == "completed" AND stop.order_amount == 0 → `"visited_no_order"`
- stop.status == "missed" → `"missed"`
- stop.status en {"pending", "in_progress"} → `"pending"`

Solo devuelve rutas que tienen instancia activa o del día actual (filtrar por `route_instances.fecha = today()`).

Esquema de respuesta de `get_map_customers` (solo clientes con `lat IS NOT NULL`):
```python
{
  "id": str,
  "razon_social": str,
  "lat": float,
  "lng": float,
  "visit_status": str | None,
  "last_order_amount": float,
  "current_balance": float,
  "route_id": str | None,
  "color_index": int
}
```

- [ ] **Step 1: Escribir tests**

```python
# api/tests/test_distribuidora_map.py

async def test_get_map_routes_returns_list(db_session):
    result = await get_map_routes(db_session, "00000000-0000-0000-0000-000000000010")
    assert isinstance(result, list)

async def test_get_map_routes_no_instances_returns_empty(db_session):
    # company sin instancias hoy → lista vacía, no excepción
    result = await get_map_routes(db_session, "non-existent-company-id")
    assert result == []

async def test_get_map_customers_excludes_no_coords(db_session):
    result = await get_map_customers(db_session, "00000000-0000-0000-0000-000000000010")
    assert all(c["lat"] is not None and c["lng"] is not None for c in result)

async def test_get_map_customers_no_coords_returns_empty_not_error(db_session):
    # si ningún cliente tiene coords → [] sin excepción
    result = await get_map_customers(db_session, "00000000-0000-0000-0000-000000000010")
    assert isinstance(result, list)
```

- [ ] **Step 2: Implementar `get_map_routes(db, company_id)` en `service.py`**

JOIN: `sales_routes` → `route_customers` → `customers`, filtrar `route_instances.fecha = date.today()`.
`color_index`: `enumerate()` sobre rutas ordenadas por nombre → `i % 10`.
Agrupar waypoints por `route_id`, ordenar por `route_customers.visit_order`.

- [ ] **Step 3: Implementar `get_map_customers(db, company_id)` en `service.py`**

Seleccionar todos los clientes de la empresa con `lat IS NOT NULL`. JOIN con `route_customers` para obtener `route_id`. Calcular `visit_status` joinando con `route_stops` de hoy. `color_index` igual que en `get_map_routes`.

- [ ] **Step 4: Agregar endpoints en `router.py`**

```python
@router.get("/map/routes/{company_id}")
async def map_routes(company_id: str, db: AsyncSession = Depends(get_db),
                     _: dict = Depends(require_auth)):
    return await service.get_map_routes(db, company_id)

@router.get("/map/customers/{company_id}")
async def map_customers(company_id: str, db: AsyncSession = Depends(get_db),
                        _: dict = Depends(require_auth)):
    return await service.get_map_customers(db, company_id)
```

- [ ] **Step 5: Correr tests**

```bash
cd api && pytest tests/test_distribuidora_map.py -v
```

Expected: todos PASS.

- [ ] **Step 6: Verificar endpoints manualmente**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/distribuidora/map/routes/00000000-0000-0000-0000-000000000010 | python3 -m json.tool | head -30
```

- [ ] **Step 7: Commit**

```bash
git add api/src/distribuidora/service.py api/src/distribuidora/router.py api/tests/test_distribuidora_map.py
git commit -m "feat(api): endpoints GET /distribuidora/map/routes y /map/customers"
```

---

## Task 4: Backend — endpoint rendimiento de vendedores

**Files:**
- Modify: `api/src/distribuidora/service.py` — agregar `get_seller_performance()`
- Modify: `api/src/distribuidora/router.py` — agregar ruta GET
- Create: `api/tests/test_distribuidora_performance.py`

**Interfaces:**
- Produces:
  - `get_seller_performance(db, company_id, fecha_desde, fecha_hasta, route_id=None) -> list[dict]`
  - `GET /api/v1/distribuidora/performance/sellers/{company_id}?fecha_desde=&fecha_hasta=&route_id=`

Esquema de respuesta por vendedor:
```python
{
  "seller_id": str,
  "seller_name": str,
  "photo_url": str | None,
  "coverage_pct": float,       # stops_completed / stops_total * 100  (0.0 si stops_total == 0)
  "conversion_rate": float,    # stops con order_amount > 0 / stops_completed * 100  (0.0 si 0)
  "avg_ticket": float,         # sum(order_amount) / count de stops con pedido  (0.0 si 0)
  "total_amount": float,
  "total_collected": float,    # sum(payment_collected)
  "avg_visit_minutes": float | None,
  "stops_completed": int,
  "stops_total": int,
  "weekly_coverage": [float, float, float, float]  # % cobertura últimas 4 semanas, más antigua primero
}
```

`stops_completed` = stops con status `"completed"`.
`stops_total` = todos los stops del vendedor en el período.
`weekly_coverage[i]` = cobertura de la semana `(today - (3-i)*7 days)` a `(today - (2-i)*7 days)`.

- [ ] **Step 1: Escribir tests**

```python
# api/tests/test_distribuidora_performance.py

async def test_get_seller_performance_returns_list(db_session):
    from datetime import date, timedelta
    result = await get_seller_performance(
        db_session, "00000000-0000-0000-0000-000000000010",
        fecha_desde=str(date.today() - timedelta(days=30)),
        fecha_hasta=str(date.today())
    )
    assert isinstance(result, list)

async def test_coverage_pct_is_zero_not_nan_when_no_stops(db_session):
    from datetime import date
    result = await get_seller_performance(
        db_session, "00000000-0000-0000-0000-000000000010",
        fecha_desde=str(date.today()),
        fecha_hasta=str(date.today())
    )
    for row in result:
        assert not (row["coverage_pct"] != row["coverage_pct"])  # NaN check

async def test_weekly_coverage_has_4_elements(db_session):
    from datetime import date, timedelta
    result = await get_seller_performance(
        db_session, "00000000-0000-0000-0000-000000000010",
        fecha_desde=str(date.today() - timedelta(days=30)),
        fecha_hasta=str(date.today())
    )
    for row in result:
        assert len(row["weekly_coverage"]) == 4

async def test_route_id_filter(db_session):
    from datetime import date, timedelta
    # con route_id que no existe → lista vacía sin error
    result = await get_seller_performance(
        db_session, "00000000-0000-0000-0000-000000000010",
        fecha_desde=str(date.today() - timedelta(days=30)),
        fecha_hasta=str(date.today()),
        route_id="00000000-0000-0000-0000-000000000000"
    )
    assert result == []
```

- [ ] **Step 2: Implementar `get_seller_performance()` en `service.py`**

JOIN: `route_instances` JOIN `route_stops` JOIN `distribuidora_sellers`. Agrupar por `seller_id`. Calcular todos los campos. Para `weekly_coverage`: 4 subconsultas sobre rangos semanales o una CTE con `date_trunc`. Guardar 0.0 explícito donde hay división por cero.

- [ ] **Step 3: Agregar endpoint en `router.py`**

```python
@router.get("/performance/sellers/{company_id}")
async def seller_performance(
    company_id: str,
    fecha_desde: str = Query(default=None),
    fecha_hasta: str = Query(default=None),
    route_id: str = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_auth),
):
    from datetime import date, timedelta
    if not fecha_desde:
        fecha_desde = str(date.today() - timedelta(days=30))
    if not fecha_hasta:
        fecha_hasta = str(date.today())
    return await service.get_seller_performance(db, company_id, fecha_desde, fecha_hasta, route_id)
```

- [ ] **Step 4: Correr tests**

```bash
cd api && pytest tests/test_distribuidora_performance.py -v
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/distribuidora/service.py api/src/distribuidora/router.py api/tests/test_distribuidora_performance.py
git commit -m "feat(api): endpoint GET /distribuidora/performance/sellers con cobertura y conversión"
```

---

## Task 5: Frontend — dependencias + métodos API client

**Files:**
- Modify: `ui-web/package.json`
- Modify: `ui-web/src/api/index.ts`

**Interfaces:**
- Produces (en `api.distribuidora` de `index.ts`):
  ```typescript
  map: {
    routes: (companyId: string) => Promise<MapRouteData[]>
    customers: (companyId: string) => Promise<MapCustomerData[]>
  }
  sellers: {
    performance: (companyId: string, params?: {
      fecha_desde?: string; fecha_hasta?: string; route_id?: string
    }) => Promise<SellerPerformance[]>
  }
  ```
- Interfaces TypeScript necesarias en `index.ts`:
  ```typescript
  export interface MapWaypoint { customer_id: string; razon_social: string; lat: number|null; lng: number|null; visit_order: number; visit_status: string|null }
  export interface MapRouteData { route_id: string; route_name: string; seller_name: string|null; seller_id: string|null; color_index: number; waypoints: MapWaypoint[]; depot_lat: number; depot_lng: number; is_optimized: boolean }
  export interface MapCustomerData { id: string; razon_social: string; lat: number; lng: number; visit_status: string|null; last_order_amount: number; current_balance: number; route_id: string|null; color_index: number }
  export interface SellerPerformance { seller_id: string; seller_name: string; photo_url: string|null; coverage_pct: number; conversion_rate: number; avg_ticket: number; total_amount: number; total_collected: number; avg_visit_minutes: number|null; stops_completed: number; stops_total: number; weekly_coverage: number[] }
  ```

- [ ] **Step 1: Instalar dependencias**

```bash
cd ui-web && npm install @react-google-maps/api@^2.20.3 @googlemaps/markerclusterer@^2.5.3
```

- [ ] **Step 2: Verificar que el build no se rompe**

```bash
cd ui-web && npm run build 2>&1 | tail -10
```

Expected: build exitoso sin errores.

- [ ] **Step 3: Agregar interfaces TypeScript en `index.ts`**

Agregar las 4 interfaces (`MapWaypoint`, `MapRouteData`, `MapCustomerData`, `SellerPerformance`) cerca de las otras interfaces de distribuidora (buscar `interface SalesRoute` o `interface DistribuidoraDashboard` como referencia de ubicación).

- [ ] **Step 4: Agregar métodos al objeto `distribuidora` en `index.ts`**

Dentro del objeto `distribuidora` (línea ~3873), agregar después de la sección `performance` existente:

```typescript
map: {
  routes: (companyId: string) => client.get<MapRouteData[]>(`/v1/distribuidora/map/routes/${companyId}`),
  customers: (companyId: string) => client.get<MapCustomerData[]>(`/v1/distribuidora/map/customers/${companyId}`),
},
```

Y agregar dentro de `sellers`:
```typescript
performance: (companyId: string, params?: { fecha_desde?: string; fecha_hasta?: string; route_id?: string }) =>
  client.get<SellerPerformance[]>(`/v1/distribuidora/performance/sellers/${companyId}`, params as any),
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd ui-web && npx tsc --noEmit 2>&1 | head -20
```

Expected: sin errores de tipo en los nuevos métodos.

- [ ] **Step 6: Commit**

```bash
git add ui-web/package.json ui-web/package-lock.json ui-web/src/api/index.ts
git commit -m "feat(ui): instalar @react-google-maps/api y agregar métodos API para mapa y rendimiento"
```

---

## Task 6: MapaPage.tsx — migración a Google Maps

**Files:**
- Rewrite: `ui-web/src/pages/mapa-tiempo-real/MapaPage.tsx`

**Interfaces:**
- Consumes: `api.distribuidora.liveMap(companyId)` (existente), `api.distribuidora.map.routes(companyId)` (T5), `api.distribuidora.map.customers(companyId)` (T5).
- No cambia la firma de ningún endpoint.

**Notas de implementación:**

El componente mantiene la misma estructura general (sidebar izquierda con KPIs + lista de vendedores, mapa a la derecha). Lo que cambia es la librería de mapa.

```tsx
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import { MarkerClusterer } from '@googlemaps/markerclusterer'

const MAP_CENTER = { lat: -25.2637, lng: -57.5759 }
const ROUTE_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6","#8b5cf6","#ec4899","#64748b","#0ea5e9"]
const LIBS: ("marker" | "geometry")[] = ["marker", "geometry"]

const { isLoaded, loadError } = useJsApiLoader({
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY ?? "",
  libraries: LIBS,
})
```

**Manejo de error de key ausente:**
```tsx
if (loadError || !import.meta.env.VITE_GOOGLE_MAPS_KEY) {
  return <div className="...">Google Maps API key no configurada. Agregar VITE_GOOGLE_MAPS_KEY en .env.local</div>
}
```

**Tres capas — orden de renderizado dentro de `<GoogleMap>`:**
1. Polylines de rutas: un `<Polyline>` por ruta, path = `[depot, ...waypoints con lat/lng]`, options `strokeColor: ROUTE_COLORS[color_index]`, `strokeWeight: 3`, `strokeOpacity: 0.7`
2. Markers de clientes: `AdvancedMarkerElement` vía `useEffect` + `map` ref. Color del pin según `visit_status`. Clustered con `MarkerClusterer`.
3. Markers de vendedores: igual al componente `SellerMarker` existente, reescrito como `AdvancedMarkerElement`.

**Polling:**
- Sellers (liveMap): cada 15 s (igual que antes).
- Routes + customers: una vez al montar + botón "Actualizar".

**InfoWindow de cliente** (click en marker de cliente):
```tsx
// selectedCustomer: MapCustomerData | null
// Muestra: razon_social, visit_status badge, last_order_amount, current_balance
```

- [ ] **Step 1: Verificar que MapLibre no se usa en ninguna otra página**

```bash
grep -rn "maplibre\|MapLibre\|map-gl" ui-web/src --include="*.tsx" --include="*.ts"
```

Si aparece en otras páginas, NO desinstalar maplibre-gl. Si solo aparece en MapaPage, desinstalar en el paso final.

- [ ] **Step 2: Reescribir MapaPage.tsx**

Estructura de estados:
```typescript
const [liveData, setLiveData] = useState<any>(null)
const [routeData, setRouteData] = useState<MapRouteData[]>([])
const [customerData, setCustomerData] = useState<MapCustomerData[]>([])
const [selectedCustomer, setSelectedCustomer] = useState<MapCustomerData | null>(null)
const [selectedSeller, setSelectedSeller] = useState<any>(null)
const [showRoutes, setShowRoutes] = useState(true)
const [showCustomers, setShowCustomers] = useState(true)
const mapRef = useRef<google.maps.Map | null>(null)
```

Mantener el sidebar de KPIs y lista de vendedores del componente original (misma lógica, solo cambia la visualización del mapa).

- [ ] **Step 3: Verificar en dev server**

```bash
cd ui-web && npm run dev
```

Navegar a `/mapa`. Verificar:
- El mapa de Google carga centrado en Asunción
- El error de key ausente muestra mensaje legible (si la key no está en `.env.local`)
- Con key válida: vendors aparecen como markers

- [ ] **Step 4: Desinstalar maplibre-gl si no se usa en otras páginas**

Solo si el grep del Step 1 no dio otros resultados:
```bash
cd ui-web && npm uninstall maplibre-gl
```

- [ ] **Step 5: Build de producción sin errores**

```bash
cd ui-web && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add ui-web/src/pages/mapa-tiempo-real/MapaPage.tsx ui-web/package.json ui-web/package-lock.json
git commit -m "feat(ui): migrar MapaPage de MapLibre a Google Maps JS API con 3 capas"
```

---

## Task 7: RutasPage — botón de optimización

**Files:**
- Modify: `ui-web/src/pages/rutas/RutasPage.tsx`

**Interfaces:**
- Consumes: `api.distribuidora.routes.optimize(routeId)` — ya existe en `index.ts` (línea ~3894).
- No cambia ningún endpoint.

**Comportamiento:**
- Botón "Optimizar orden" aparece en cada card de instancia de ruta cuando `inst.status === "active"` o `inst.status === "pending"`.
- Click → modal de confirmación con el nombre de la ruta y el vendedor.
- Confirmar → `setOptimizing(routeId)` + llamar `api.distribuidora.routes.optimize(inst.route_id)`.
- Éxito → toast success + `loadStops(inst.id)` para refrescar el orden.
- Error 400 (< 2 clientes con GPS) → toast con el mensaje de error del backend.

- [ ] **Step 1: Agregar estado `optimizing`**

```typescript
const [optimizing, setOptimizing] = useState<string | null>(null)  // route_id | null
const [optimizeTarget, setOptimizeTarget] = useState<any>(null)     // instancia seleccionada para confirmar
```

- [ ] **Step 2: Agregar función `handleOptimize`**

```typescript
const handleOptimize = async (inst: any) => {
  setOptimizing(inst.route_id)
  try {
    await api.distribuidora.routes.optimize(inst.route_id)
    toast.success("Ruta optimizada", `Orden actualizado para ${inst.seller_name || "el preventista"}.`)
    if (selected?.id === inst.id) await loadStops(inst.id)
  } catch (e: any) {
    toast.error("No se pudo optimizar", e?.response?.data?.detail || String(e))
  } finally {
    setOptimizing(null)
    setOptimizeTarget(null)
  }
}
```

- [ ] **Step 3: Agregar botón en cada card de instancia**

Buscar donde se renderizan las acciones de la instancia (cerca del botón de inicio/fin de ruta). Agregar:
```tsx
<button
  onClick={() => setOptimizeTarget(inst)}
  disabled={optimizing === inst.route_id}
  className="..."
>
  {optimizing === inst.route_id ? <Spinner /> : <Sparkles className="w-4 h-4" />}
  Optimizar orden
</button>
```

- [ ] **Step 4: Agregar modal de confirmación**

Modal simple con: nombre de ruta, vendedor, advertencia "Se reordenarán las paradas". Botones "Cancelar" y "Optimizar".

```tsx
{optimizeTarget && (
  <ConfirmModal
    title="Optimizar orden de ruta"
    message={`Reordenar las paradas de "${routeName}" para minimizar el recorrido. Se notificará a ${sellerName}.`}
    onConfirm={() => handleOptimize(optimizeTarget)}
    onCancel={() => setOptimizeTarget(null)}
  />
)}
```

- [ ] **Step 5: Verificar en dev server**

Navegar a `/rutas`, expandir una instancia activa, verificar que el botón aparece. Verificar que un error 400 del backend muestra toast de error, no pantalla rota.

- [ ] **Step 6: Commit**

```bash
git add ui-web/src/pages/rutas/RutasPage.tsx
git commit -m "feat(ui): botón optimizar orden de ruta con confirmación y manejo de errores"
```

---

## Task 8: RendimientoVendedoresPage — nueva pantalla distribuidora

**Files:**
- Create: `ui-web/src/pages/distribuidora/RendimientoVendedoresPage.tsx`
- Modify: `ui-web/src/App.tsx` — lazy import + ruta

**Interfaces:**
- Consumes: `api.distribuidora.sellers.performance(companyId, params)` de T5.
- No reemplaza `pages/rendimiento/RendimientoPage.tsx` (es supermercado-specific, no tocar).

**Layout de la página:**

```
┌─────────────────────────────────────────────────────────┐
│  Header: "Rendimiento de Preventistas"                   │
│  Filtros: fecha_desde / fecha_hasta / ruta               │
├────────┬─────────┬───────────┬──────────┬───────────────┤
│ KPI bar: total vendedores activos · total pedidos · cobertura promedio · monto total │
├─────────────────────────────────────────────────────────┤
│  Tabla ordenable por columna:                           │
│  Vendedor | Cobertura% | Conversión% | Ticket Gs. | Monto | Cobros | Tiempo | Tendencia │
│  [sparkline 4 semanas en columna Tendencia]             │
├─────────────────────────────────────────────────────────┤
│  Botón exportar CSV                                     │
└─────────────────────────────────────────────────────────┘
```

Sparkline: componente React inline con SVG (4 puntos, sin dependencia externa):
```tsx
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const W = 60, H = 24
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * H}`).join(" ")
  return <svg width={W} height={H}><polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="1.5" /></svg>
}
```

Exportación CSV: `window.URL.createObjectURL(new Blob([csvString], {type: "text/csv"}))` — sin librerías.

- [ ] **Step 1: Crear `RendimientoVendedoresPage.tsx`**

Estados:
```typescript
const [data, setData] = useState<SellerPerformance[]>([])
const [loading, setLoading] = useState(true)
const [sortCol, setSortCol] = useState<keyof SellerPerformance>("coverage_pct")
const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
const [fechaDesde, setFechaDesde] = useState(/* 30 días atrás en YYYY-MM-DD */)
const [fechaHasta, setFechaHasta] = useState(/* hoy en YYYY-MM-DD */)
const [routeFilter, setRouteFilter] = useState<string>("")
```

Cargar con `useEffect` cuando cambia cualquier filtro. Implementar `Sparkline` inline.

- [ ] **Step 2: Agregar lazy import en `App.tsx`**

```typescript
const RendimientoVendedoresPage = lazy(() => import("./pages/distribuidora/RendimientoVendedoresPage"))
```

Agregar ruta en el array de rutas: `["distribuidora/rendimiento-vendedores", <RendimientoVendedoresPage />]`.

- [ ] **Step 3: Agregar entry en el menú de navegación**

Buscar donde se define la navegación del sidebar para el vertical distribuidora (probablemente en un componente `Sidebar` o en el array de rutas con label). Agregar `"Rendimiento Vendedores"` con icono `Trophy` apuntando a `/distribuidora/rendimiento-vendedores`.

- [ ] **Step 4: Verificar en dev server**

Navegar a `/distribuidora/rendimiento-vendedores`. Verificar:
- Tabla carga con datos del endpoint
- Click en columna cambia el orden
- Botón CSV descarga un archivo válido
- Con rango de fechas sin datos: tabla vacía sin error

- [ ] **Step 5: Build final limpio**

```bash
cd ui-web && npm run build 2>&1 | tail -5
```

Expected: sin errores ni warnings de tipo.

- [ ] **Step 6: Commit**

```bash
git add ui-web/src/pages/distribuidora/RendimientoVendedoresPage.tsx ui-web/src/App.tsx
git commit -m "feat(ui): pantalla Rendimiento de Preventistas con tabla ordenable, sparklines y exportación CSV"
```

---

## Orden de ejecución recomendado

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8
```

T1 (migration) es el bloqueador de T2 y T3. T5 (deps + API client) es el bloqueador de T6, T7 y T8. T3 y T4 pueden correr en paralelo. T6, T7 y T8 pueden correr en paralelo una vez que T5 esté completo.
