# Viajes y Logística Distribuidora — Diseño Técnico

**Fecha:** 2026-10-15  
**Vertical:** Distribuidora (Casa Gonzalito)  
**Sub-proyecto:** SP5 — Armado de Viajes + Confirmaciones en Ruta

---

## Objetivo

Cubrir el ciclo logístico completo de la distribuidora: el despachante arma los viajes del día asignando pedidos facturados a cada camión (con validación de peso), el cobrador confirma entrega parada por parada desde su celular, y el sistema genera NCs automáticas ante rechazos o faltantes. Todo en la misma PWA `ui-web`, sin app separada.

---

## Contexto y dependencias

| Módulo | Rol en SP5 |
|--------|-----------|
| `sales_orders` | Pedidos `facturado` pendientes de asignar al camión |
| `products.peso_kg` (SP4) | Cálculo de peso por pedido para validar capacidad |
| `route_sessions` (SP3) | Trip se vincula al RouteSession vía `route_session_id` |
| `delivery_notes` (SP2) | NC auto-creadas ante rechazo o faltante en parada |
| RBAC existente | Rol `despachante` para DespachoPage, rol `cobrador` para MiViajeHoyPage |

---

## Modelo de Datos

Nuevo módulo: `api/src/viajes/`  
Prefijo de tablas: `trip_`

### `trip_vehicles` — Camiones registrados

```
id               UUID PK
company_id       UUID NOT NULL
patente          VARCHAR(15) NOT NULL
descripcion      VARCHAR(100)           -- ej. "Mercedes 915 - Ruta Norte"
max_weight_kg    NUMERIC(10,2) NOT NULL -- capacidad máxima en kg
activo           BOOLEAN DEFAULT true
created_at       TIMESTAMPTZ DEFAULT now()
UNIQUE (company_id, patente)
```

### `trips` — Un viaje = un camión + cobrador + día

```
id               UUID PK
company_id       UUID NOT NULL
cobrador_id      UUID NOT NULL          -- FK users
patente          VARCHAR(15) NOT NULL
fecha            DATE NOT NULL
estado           VARCHAR(20) NOT NULL DEFAULT 'armando'
                 -- armando | listo | en_ruta | completado | cancelado
km_salida        INTEGER                -- odómetro al salir
km_llegada       INTEGER                -- odómetro al llegar
peso_total_kg    NUMERIC(10,2)          -- suma calculada al confirmar despacho
route_session_id UUID                   -- FK route_sessions, se llena al salir
despachante_id   UUID NOT NULL          -- FK users
created_at       TIMESTAMPTZ DEFAULT now()
INDEX (company_id, fecha)
UNIQUE (company_id, cobrador_id, fecha)
```

### `trip_stops` — Una parada = un pedido a un cliente

```
id               UUID PK
trip_id          UUID NOT NULL FK trips
sales_order_id   UUID NOT NULL FK sales_orders
customer_id      UUID NOT NULL
orden_visita     INTEGER NOT NULL       -- 1, 2, 3... define el orden en ruta
estado           VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                 -- pendiente | entregado | rechazado_parcial | rechazado_total | faltante
firmado          BOOLEAN DEFAULT false
observaciones    TEXT
visited_at       TIMESTAMPTZ
INDEX (trip_id)
```

### `trip_stop_items` — Ítems confirmados por parada

```
id                   UUID PK
stop_id              UUID NOT NULL FK trip_stops ON DELETE CASCADE
sales_order_item_id  UUID NOT NULL FK sales_order_items
product_id           UUID NOT NULL
cantidad_asignada    NUMERIC(12,3) NOT NULL
cantidad_entregada   NUMERIC(12,3) NOT NULL DEFAULT 0
cantidad_rechazada   NUMERIC(12,3) NOT NULL DEFAULT 0
cantidad_faltante    NUMERIC(12,3) NOT NULL DEFAULT 0
nc_id                UUID                   -- FK delivery_notes, creada si hay diferencia
```

---

## API — Endpoints

Prefijo: `/api/v1/distribuidora/viajes/`  
Auth: `require_auth` estándar en todos.

| Método | Path | Descripción |
|--------|------|-------------|
| `GET` | `/vehicles` | Lista camiones activos de la empresa |
| `POST` | `/vehicles` | Registra un camión nuevo |
| `GET` | `/pending-orders` | SalesOrders facturados sin trip para una fecha/empresa |
| `GET` | `/` | Lista trips del día (company_id + fecha) |
| `POST` | `/` | Crea un trip en estado `armando` |
| `PATCH` | `/{trip_id}/stops` | Reemplaza las paradas del trip (dispatcher asigna/reordena) |
| `POST` | `/{trip_id}/confirm` | Dispatcher confirma despacho → estado `listo`, calcula peso_total_kg |
| `GET` | `/mi-viaje-hoy` | Trip del cobrador autenticado para hoy |
| `POST` | `/{trip_id}/salida` | Cobrador registra km_salida → estado `en_ruta` |
| `POST` | `/{trip_id}/stops/{stop_id}/confirm` | Cobrador confirma parada; genera NC si hay diferencias |
| `POST` | `/{trip_id}/llegada` | Cobrador registra km_llegada → estado `completado` |

### Lógica de NC automática en `confirm_stop`

Cuando `cantidad_rechazada > 0`:
- Crea `DeliveryNote` con `concepto = "no_es_su_pedido"`, `monto = precio_unitario * cantidad_rechazada`

Cuando `cantidad_faltante > 0`:
- Crea `DeliveryNote` con `concepto = "faltante_deposito"`, `monto = precio_unitario * cantidad_faltante`

Guarda el `nc_id` en el `TripStopItem`.  
El estado de la parada se calcula: si toda la diferencia = cantidad_asignada → `rechazado_total`; si parcial → `rechazado_parcial`; si solo faltante → `faltante`; si todo entregado → `entregado`.

---

## Frontend SP5a — DespachoPage (escritorio, rol: despachante)

**Archivo:** `ui-web/src/pages/distribuidora/DespachoPage.tsx`  
**Ruta:** `/distribuidora/despacho`  
**Dependencia nueva:** `@dnd-kit/core` + `@dnd-kit/sortable`

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Fecha picker]                    [Confirmar despacho ▶]   │
├──────────────────────┬──────────────────────────────────────┤
│  PEDIDOS PENDIENTES  │   CAMIÓN A (patente) — cobrador      │
│  ──────────────────  │   ████████░░░░ 3.200 / 5.000 kg 🟢  │
│  [card cliente A]    │   [card pedido 1]                    │
│  [card cliente B]    │   [card pedido 3]                    │
│  [card cliente C]    ├──────────────────────────────────────┤
│                      │   CAMIÓN B (patente) — cobrador      │
│                      │   ██████████████ 5.100 / 5.000 kg 🔴 │
│                      │   [card pedido 2]                    │
└──────────────────────┴──────────────────────────────────────┘
```

- **Panel izquierdo:** `DraggableOrderCard` por cada `SalesOrder` pendiente. Muestra: cliente, nro factura, total Gs, kg estimado, zona (badge de color).
- **Columnas de camión:** `DroppableColumn`. Header con patente + cobrador + `WeightBar` (verde <80%, ámbar 80-100%, rojo >100%). Cards son `SortableOrderCard` (reordenables dentro de la columna).
- **Drag:** `DndContext` con `DragOverlay`. Al soltar en columna se agrega; al soltar en panel izquierdo se quita.
- **Confirmar:** deshabilitado si alguna columna está en rojo. Llama `PATCH /stops` por cada trip + `POST /confirm`.

### Gestión de camiones del día

Antes del armado, el despachante selecciona qué camiones salen hoy (dropdown de `trip_vehicles`). Cada camión seleccionado crea un `Trip` en `armando`. Los trips ya existentes del día se cargan al abrir la página.

---

## Frontend SP5b — MiViajeHoyPage (mobile-first, rol: cobrador)

**Archivo:** `ui-web/src/pages/distribuidora/MiViajeHoyPage.tsx`  
**Ruta:** `/distribuidora/mi-viaje`

### Pantalla principal — lista de paradas

- Header: fecha, patente del camión
- Si `estado = listo` y sin km_salida: banner azul con input **km_salida** + botón "Salir" (llama `POST /salida`)
- Lista de paradas en `orden_visita`: nombre cliente, dirección, total factura, badge de estado
- Barra de progreso: `N / Total paradas completadas`
- Si todas completadas y `km_llegada` sin registrar: botón "Cerrar viaje" → input km_llegada → `POST /llegada` → redirige a `/distribuidora/rendiciones`

### Modal de parada

Al tocar una parada en estado `pendiente`:
- Nombre cliente + nro factura
- Lista de ítems: descripción, `cantidad_asignada`
- Por ítem: `input cantidad_entregada` (default = asignada, numérico)
  - Si `cantidad_entregada < cantidad_asignada`: aparece selector `¿Rechazado? / ¿Faltante?` para la diferencia
- Checkbox "Firmado por cliente"
- Campo observaciones (opcional)
- Botón **Confirmar parada** → `POST /stops/{id}/confirm`
  - Si genera NC: muestra toast "NC generada por Gs X.XXX" 
- Botón Cancelar (cierra sin guardar)

### Paradas ya confirmadas

Muestran badge de estado (entregado/rechazado/faltante) en verde/naranja/rojo. No son editables.

---

## Navegación y acceso por rol

En `DistribuidoraPage.tsx` se agregan dos botones de acceso rápido:
- `Despacho` (ícono `Truck`) → `/distribuidora/despacho` — visible solo para roles con permiso `viajes:despacho`
- `Mi Viaje` (ícono `MapPin`) → `/distribuidora/mi-viaje` — visible solo para rol `cobrador`

En `App.tsx`: 2 rutas lazy adicionales.

---

## Restricciones globales

- Rama exclusiva `vertical/distribuidora`
- `Dashboard.tsx` y `Layout.tsx` no se tocan
- Moneda PYG canónica con separador de miles
- `@dnd-kit/core` y `@dnd-kit/sortable` son las únicas deps nuevas
- Cada endpoint valida `company_id` del token contra el recurso
- NC solo se genera si `delivery_notes` service es accesible; error en NC no rollbackea la parada

---

## Flujo de estados completo

```
SalesOrder (facturado)
        │
        ▼ dispatcher asigna
  Trip [armando] ──PATCH stops──► Trip [armando]
        │
        ▼ dispatcher confirma
  Trip [listo]
        │
        ▼ cobrador POST /salida (km_salida)
  Trip [en_ruta]
        │
        ├─► TripStop [entregado]        → sin NC
        ├─► TripStop [rechazado_*]      → DeliveryNote concepto=no_es_su_pedido
        └─► TripStop [faltante]         → DeliveryNote concepto=faltante_deposito
        │
        ▼ cobrador POST /llegada (km_llegada)
  Trip [completado]
        │
        ▼ vincula route_session_id
  RouteSession → RouteLiquidation (SP3)
```
