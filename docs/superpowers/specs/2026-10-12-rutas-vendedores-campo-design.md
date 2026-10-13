# Rutas y Vendedores de Campo — Diseño

**Fecha:** 2026-10-12
**Cliente:** Casa Gonzalito (company_id `00000000-0000-0000-0000-000000000010`)
**Rama:** `vertical/distribuidora`
**Referencia:** industria Repsly, Skynamo, Badger Maps, Salesforce Maps

---

## 1. Contexto y estado actual

### Lo que ya existe y funciona
| Componente | Archivo | Estado |
|---|---|---|
| Mapa en tiempo real | `ui-web/src/pages/mapa-tiempo-real/MapaPage.tsx` | Funciona, MapLibre GL — **migrar a Google Maps** |
| Ejecución de rutas | `ui-web/src/pages/rutas/RutasPage.tsx` | Funciona, buen esqueleto |
| Historial de visitas | `ui-web/src/pages/visitas/VisitasPage.tsx` | Funciona, tabla básica |
| Geocercas | `ui-web/src/pages/geocercas/GeocercasPage.tsx` | Funciona |
| Liquidaciones | `ui-web/src/pages/route-cash-settlements/RouteCashSettlementsPage.tsx` | Existe, básico |
| API supervisor | `api/src/distribuidora/router.py` | Parcialmente completo |
| Optimización de ruta (backend) | `api/src/distribuidora/service.py:optimize_route()` | Implementado, llama Google Routes API TSP |
| API mobile (Inteliforce) | `api/src/inteliforce/router.py` | Completo — SSE tracking, visitas, asistencia |
| Tracking en tiempo real | `api/src/distribuidora/tracking_router.py` | Funciona, SSE + polling |

### Gaps críticos
1. El mapa usa OpenStreetMap/MapLibre — calidad insuficiente para Paraguay
2. El mapa no muestra clientes geocodificados ni rutas planeadas
3. `customers` no tiene columnas `lat`/`lng`
4. No hay UI para activar la optimización de ruta que ya existe en el backend
5. No hay pantalla de rendimiento de vendedores (cobertura, conversión, ticket)

---

## 2. Arquitectura general

### Diagrama de capas

```
┌─────────────────────────────────────────────────────────┐
│  Supervisor Web (React/Vite)                             │
│                                                          │
│  MapaPage (Google Maps)                                  │
│  ├── Capa 1: route polylines (rutas planeadas)           │
│  ├── Capa 2: customer markers (estado visita del día)    │
│  └── Capa 3: seller markers (ubicación en tiempo real)   │
│                                                          │
│  RutasPage  VisitasPage  RendimientoPage  LiquidPage     │
└─────────────────────────────────────────────────────────┘
              ↕  REST/SSE
┌─────────────────────────────────────────────────────────┐
│  FastAPI Backend                                         │
│                                                          │
│  /distribuidora/map/routes        (nuevo)                │
│  /distribuidora/map/customers     (nuevo)                │
│  /distribuidora/performance/sellers (nuevo)              │
│  /distribuidora/routes/{id}/optimize (existe)            │
│  /distribuidora/tracking/live-map (existe)               │
└─────────────────────────────────────────────────────────┘
              ↕  SSE + REST
┌─────────────────────────────────────────────────────────┐
│  Inteliforce (SueldOK mobile app)                        │
│  GPS tracking  ·  check-in/out  ·  pedidos  ·  cobros   │
└─────────────────────────────────────────────────────────┘
              ↕  sync incremental (cron horario)
┌─────────────────────────────────────────────────────────┐
│  Columbia MySQL legacy (datos históricos)                │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Migración del mapa: MapLibre → Google Maps

### Dependencias frontend
```
@react-google-maps/api   ^2.20.x
@googlemaps/markerclusterer  ^2.x   (clusters automáticos)
```

### Variable de entorno (frontend)
```
# ui-web/.env.local  (servidor — no va en git)
VITE_GOOGLE_MAPS_KEY=<nueva_key_rotada>
```

La key backend ya fue movida a `GOOGLE_MAPS_API_KEY` en `.env` (commit `0e9b3798`).

### Componente raíz del mapa
```tsx
// MapaPage.tsx — reemplaza MapLibre por:
import { GoogleMap, useJsApiLoader, AdvancedMarkerElement, Polyline, Polygon } from '@react-google-maps/api'

const { isLoaded } = useJsApiLoader({
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  libraries: ['marker', 'geometry'],
})
```

Centro inicial: `{ lat: -25.2637, lng: -57.5759 }` (Asunción, Paraguay)

### Tres capas simultáneas

**Capa 1 — Rutas planeadas** (polylines)
- Fuente: `GET /distribuidora/map/routes/{company_id}`
- Una polyline por ruta activa del día: del depósito → clientes en orden asignado
- 10 colores fijos por ruta (índice mod 10), grosor 3px, opacidad 0.7
- Cuando la ruta es optimizada: polyline en naranja punteado mostrando orden nuevo

**Capa 2 — Clientes geocodificados** (markers)
- Fuente: `GET /distribuidora/map/customers/{company_id}`
- `AdvancedMarkerElement` con div de 10px:
  - Verde (`#22c55e`): visitado con pedido
  - Azul (`#3b82f6`): visitado sin pedido
  - Gris (`#9ca3af`): pendiente
  - Rojo (`#ef4444`): perdido / no atendido
- Click → `InfoWindow` con: nombre cliente, saldo deudor Gs., último pedido, distancia GPS del checkin

**Capa 3 — Vendedores en tiempo real** (markers)
- Fuente: `api.distribuidora.tracking.liveMap()` polling 15 s (ya existe)
- Foto circular con ring de color por estado
- Click → panel lateral deslizable: datos del vendedor, progreso de la ruta del día, batería, velocidad
- Sin cambios de lógica existente, solo reemplaza la librería de mapa

### Clusters
`MarkerClusterer` activa automáticamente cuando hay > 30 markers de clientes en el viewport. Sin configuración extra.

---

## 4. Geocodificación de clientes

### Migration de base de datos (Alembic)
```python
# nueva revisión Alembic
op.add_column('customers', sa.Column('lat', sa.Numeric(10, 8), nullable=True))
op.add_column('customers', sa.Column('lng', sa.Numeric(11, 8), nullable=True))
op.add_column('customers', sa.Column('geocoded_at', sa.DateTime(timezone=True), nullable=True))
```

### Script de geocodificación batch
Archivo: `scripts/geocode_customers.py`

```
Para cada cliente sin lat/lng en company_id:
  query = f"{direccion}, {ciudad}, Paraguay"
  GET https://maps.googleapis.com/maps/api/geocode/json?address={query}&key={API_KEY}
  Si result OK → UPDATE customers SET lat, lng, geocoded_at
  Rate limit: 50 req/s (límite Standard Google Geocoding API)
  Loguea cuántos quedan sin geocodificar
```

El vendedor puede corregir la ubicación desde Inteliforce → `PUT /inteliforce/customers/{id}/location` (ya existe, persiste en DB).

### Nuevo endpoint supervisor
```
GET /api/v1/distribuidora/map/customers/{company_id}
→ [{
    id, razon_social, lat, lng,
    visit_status: "visited_order" | "visited_no_order" | "pending" | "missed" | null,
    last_order_amount, current_balance,
    route_id, route_color_index
  }]
```
Filtra solo clientes con `lat IS NOT NULL`. El `visit_status` se calcula joinando con `route_stops` de hoy.

---

## 5. Rutas planeadas en el mapa

### Nuevo endpoint
```
GET /api/v1/distribuidora/map/routes/{company_id}
→ [{
    route_id, route_name, seller_name, color_index,
    waypoints: [{customer_id, lat, lng, visit_order, status}],
    depot: {lat: -25.3235, lng: -57.5641},
    is_optimized: bool,
    optimized_polyline: str | null  (encoded polyline si ya se optimizó)
  }]
```

Solo devuelve rutas con instancia activa o del día actual.

---

## 6. Optimización de rutas — UI

En `RutasPage.tsx`, cada card de instancia de ruta agrega un botón "Optimizar orden":

**Flujo:**
1. Click → modal de confirmación: "Reordenar las N paradas usando Google Maps para minimizar el tiempo de recorrido. Se notificará al preventista."
2. Confirmar → spinner → `POST /api/v1/distribuidora/routes/{route_id}/optimize`
3. Éxito → toast "Ruta optimizada. Orden actualizado para {vendedor}."
4. El mapa redibuja la polyline de esa ruta en el nuevo orden

**Condición:** el endpoint ya existe en el backend (`service.py:optimize_route()`). Solo se agrega el botón y el modal.

---

## 7. Rendimiento de Vendedores

### Nueva página: `RendimientoPage.tsx`

**Ruta:** `/distribuidora/rendimiento`

**Métricas por vendedor:**
| Métrica | Cálculo | Fuente |
|---|---|---|
| % Cobertura | stops visitados / stops asignados | route_instances + route_stops |
| Tasa conversión | stops con order_amount > 0 / stops totales | route_stops |
| Ticket promedio Gs. | sum(order_amount) / orders_count | route_stops |
| Tiempo medio/visita | avg(actual_departure - actual_arrival) | route_stops |
| Cobros Gs. | sum(payment_collected) | route_stops |

**Layout:**
- KPI bar superior: totales de la empresa del día
- Tabla ordenable por cualquier columna
- Sparkline de 4 semanas (cobertura) por vendedor
- Filtros: rango de fechas, ruta específica
- Exportación CSV

### Nuevo endpoint backend
```
GET /api/v1/distribuidora/performance/sellers/{company_id}
  ?fecha_desde=YYYY-MM-DD&fecha_hasta=YYYY-MM-DD&route_id=uuid
→ [{
    seller_id, seller_name, photo_url,
    coverage_pct, conversion_rate, avg_ticket,
    total_amount, total_collected,
    avg_visit_minutes, stops_completed, stops_total,
    weekly_coverage: [float, float, float, float]  // últimas 4 semanas
  }]
```

Agrega desde `route_instances` JOIN `route_stops` JOIN `users`.

---

## 8. Archivos a crear / modificar

### Backend (`api/src/`)

| Archivo | Acción | Descripción |
|---|---|---|
| `config.py` | ✅ ya modificado | `google_maps_api_key` declarado |
| `distribuidora/service.py` | ✅ ya modificado | key desde settings |
| `distribuidora/service.py` | modificar | agregar `get_map_routes()`, `get_map_customers()`, `get_seller_performance()` |
| `distribuidora/router.py` | modificar | 3 nuevos endpoints GET |
| `alembic/versions/XXXX_geocoords_customers.py` | crear | columnas lat/lng/geocoded_at |
| `scripts/geocode_customers.py` | crear | batch geocoding |

### Frontend (`ui-web/src/`)

| Archivo | Acción | Descripción |
|---|---|---|
| `pages/mapa-tiempo-real/MapaPage.tsx` | reescribir | MapLibre → Google Maps, 3 capas |
| `pages/rutas/RutasPage.tsx` | modificar | botón + modal optimizar orden |
| `pages/distribuidora/RendimientoPage.tsx` | crear | tabla de rendimiento de vendedores |
| `package.json` | modificar | agregar `@react-google-maps/api`, `@googlemaps/markerclusterer` |

### Infraestructura

| Archivo | Acción |
|---|---|
| `ui-web/.env.local` (servidor) | agregar `VITE_GOOGLE_MAPS_KEY=<nueva_key>` |
| `.env` (servidor) | ya tiene `GOOGLE_MAPS_API_KEY` — actualizar con key rotada |

---

## 9. Orden de implementación

1. **Alembic migration** — columnas lat/lng en customers (no rompe nada)
2. **Script geocode_customers.py** — poblar lat/lng del batch inicial
3. **3 nuevos endpoints backend** — map/routes, map/customers, performance/sellers
4. **Instalar dependencias frontend** — @react-google-maps/api
5. **Migrar MapaPage.tsx** — reemplazar MapLibre por Google Maps con 3 capas
6. **Botón optimizar en RutasPage.tsx** — UI para el endpoint que ya existe
7. **RendimientoPage.tsx** — nueva pantalla + agregar a navegación

---

## 10. Decisiones de diseño y restricciones

- **No se toca Inteliforce**: la app mobile no cambia. Solo se consume su data desde el supervisor.
- **No se cambia la estructura de rutas**: `sales_routes` / `route_customers` / `route_instances` permanecen iguales.
- **Sin nueva tabla para GPS de clientes**: las columnas van directo en `customers`, no en tabla separada, ya que son atributos del cliente.
- **MapLibre queda eliminado del proyecto** si no se usa en ninguna otra página. Verificar con grep antes de desinstalar.
- **Google Maps key**: una sola key sirve para Maps JS API + Routes API + Geocoding API si están habilitadas en Google Cloud Console.
- **API key restriction**: en Google Cloud Console, restringir la key del backend a las IPs del servidor. La key del frontend restringir a HTTP referrers (`intelimarket.gonzalito.com.py`).
