# Caja de Ruta y Tesorería — Diseño

**Vertical:** Distribuidora (Casa Gonzalito)  
**Fecha:** 2026-10-14  
**Sub-proyecto:** #3 del roadmap distribuidora

## Objetivo

Reemplazar el flujo `cajas → cajaautoriza → depositoenbanco` del legacy MySQL por un módulo nativo en InteliMarket que gestione el ciclo completo de liquidación diaria de cobradores de ruta: apertura de sesión con fondo inicial, reconciliación híbrida al retorno, autorización del supervisor y depósito bancario unificado (rutas + retail).

## Arquitectura

**Enfoque elegido:** Módulo `ruta_caja` completamente nuevo, independiente del módulo `caja` existente (retail POS). La pantalla de depósito bancario del tesorero unifica ambas fuentes (rutas + retail) en una sola vista.

**Stack:** FastAPI + SQLAlchemy async + PostgreSQL + React 18 + TypeScript. Patrón existente del proyecto.

**Reconciliación:** Híbrida — el sistema calcula automáticamente lo esperado desde AR (receivable_payments + pagare_payments del cobrador del día) y lo muestra como referencia. El cobrador declara lo que físicamente trae. El supervisor decide si acepta la diferencia.

**Acceso web:** Cobradores, supervisores y tesoreros usan la app web. La vista del cobrador es responsive (funciona en mobile).

## Modelo de datos

### Tablas nuevas

```sql
route_sessions
  id              UUID PK DEFAULT gen_random_uuid()
  company_id      UUID NOT NULL
  cobrador_id     UUID NOT NULL REFERENCES users(id)
  route_id        UUID REFERENCES routes(id)          -- nullable
  fecha           DATE NOT NULL
  estado          VARCHAR NOT NULL DEFAULT 'abierta'  -- abierta/cerrada/liquidada/observada
  fondo_inicial   NUMERIC(18,0) NOT NULL DEFAULT 0
  fondo_sobrante  NUMERIC(18,0)                       -- efectivo de fondo que vuelve sin usar
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  closed_at       TIMESTAMPTZ
  created_by      UUID NOT NULL REFERENCES users(id)
  UNIQUE(company_id, cobrador_id, fecha)              -- una sesión por cobrador por día

route_liquidations
  id                      UUID PK DEFAULT gen_random_uuid()
  route_session_id        UUID NOT NULL REFERENCES route_sessions(id)
  efectivo_declarado      NUMERIC(18,0) NOT NULL DEFAULT 0
  cheques_declarado       NUMERIC(18,0) NOT NULL DEFAULT 0
  pagares_declarado       NUMERIC(18,0) NOT NULL DEFAULT 0
  nc_aplicadas            NUMERIC(18,0) NOT NULL DEFAULT 0
  descuentos_autorizados  NUMERIC(18,0) NOT NULL DEFAULT 0
  efectivo_esperado       NUMERIC(18,0) NOT NULL DEFAULT 0  -- calculado desde AR al cerrar
  total_cobrado_ar        NUMERIC(18,0) NOT NULL DEFAULT 0  -- sum(receivable_payments) del día
  diferencia              NUMERIC(18,0) GENERATED ALWAYS AS (efectivo_declarado - efectivo_esperado) STORED
  estado                  VARCHAR NOT NULL DEFAULT 'pendiente'  -- pendiente/autorizada/observada/rechazada
  supervisor_id           UUID REFERENCES users(id)
  observaciones           TEXT
  fecha_autorizacion      TIMESTAMPTZ
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()

route_liquidation_items
  id              UUID PK DEFAULT gen_random_uuid()
  liquidation_id  UUID NOT NULL REFERENCES route_liquidations(id) ON DELETE CASCADE
  tipo            VARCHAR NOT NULL  -- 'cheque' | 'pagare'
  numero          VARCHAR NOT NULL
  banco           VARCHAR           -- nullable para pagarés
  monto           NUMERIC(18,0) NOT NULL
  customer_id     UUID REFERENCES customers(id)
  vencimiento     DATE

bank_deposits
  id                      UUID PK DEFAULT gen_random_uuid()
  company_id              UUID NOT NULL
  fecha                   DATE NOT NULL
  bank_name               VARCHAR NOT NULL
  account_number          VARCHAR NOT NULL
  monto_efectivo          NUMERIC(18,0) NOT NULL DEFAULT 0
  monto_cheques           NUMERIC(18,0) NOT NULL DEFAULT 0
  referencia              VARCHAR               -- nro boleta de depósito
  route_liquidation_ids   JSONB NOT NULL DEFAULT '[]'
  cash_session_ids        JSONB NOT NULL DEFAULT '[]'
  observaciones           TEXT
  created_by              UUID NOT NULL REFERENCES users(id)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**Restricción de negocio:** Una sesión por cobrador por día (UNIQUE constraint). Si hay sesión anterior sin cerrar, bloquear apertura de nueva.

## Componentes

### Backend: `api/src/ruta_caja/`

```
models.py     — RouteSession, RouteLiquidation, RouteLiquidationItem, BankDeposit
schemas.py    — Pydantic schemas para cada modelo + responses
service.py    — lógica de negocio (cálculo AR, validaciones, reconciliación)
router.py     — endpoints REST
```

### Endpoints: `/api/v1/distribuidora/`

```
POST   route-sessions                       abrir sesión (supervisor/admin)
GET    route-sessions                       listar (fecha, cobrador_id, estado)
GET    route-sessions/{id}                  detalle + resumen AR del cobrador del día
POST   route-sessions/{id}/close           cobrador declara y cierra
GET    route-liquidations/{id}             detalle de liquidación
POST   route-liquidations/{id}/authorize   supervisor autoriza
POST   route-liquidations/{id}/observe     supervisor observa (agrega nota, pide aclaración)
POST   route-liquidations/{id}/reject      supervisor rechaza
GET    treasury/daily-summary              resumen tesorero (rutas + retail caja)
POST   treasury/bank-deposit               registrar depósito bancario
```

### Frontend

**`ui-web/src/pages/distribuidora/RendicionesPage.tsx`** — vista cobrador (responsive/mobile)
- Banner: sesión activa / sin sesión
- Cards: Fondo inicial | Cobrado en AR | Pagarés del día | NCs aplicadas
- Tabla: facturas cobradas hoy (desde AR, filtradas por cobrador_id)
- Estado de liquidación cuando existe
- Botón "Rendir al supervisor" → modal de cierre: efectivo declarado + detalle de cheques/pagarés físicos

**`ui-web/src/pages/distribuidora/LiquidacionesPage.tsx`** — supervisor
- Header: fecha del día, botón "Abrir sesión"
- Modal abrir sesión: seleccionar cobrador, ruta (opcional), fondo inicial
- Tabla de sesiones del día: cobrador | ruta | fondo | cobrado AR | declarado | diferencia | estado | acción
- Click en fila → drawer detalle: reconciliación completa, botones Autorizar / Observar / Rechazar

**`ui-web/src/pages/distribuidora/TesoreriaPage.tsx`** — tesorero (Opción C: unifica fuentes)
- Dos paneles colapsables: "Cajas de Ruta" y "Cajas Retail"
- Panel Rutas: lista de liquidaciones autorizadas del día + totales (efectivo, cheques, pagarés)
- Panel Retail: resumen del vault del día (query a CashSession existente, solo lectura)
- Footer sticky: Total efectivo a depositar | Total cheques
- Botón "Registrar depósito bancario" → modal: banco, cuenta, nro boleta, monto efectivo, monto cheques, notas

## Flujo de datos

```
1. Mañana: supervisor POST route-sessions → estado "abierta", fondo_inicial registrado

2. Durante el día: cobrador usa AccountsReceivablePage normalmente
   → receivable_payments / pagare_payments / delivery_notes se crean
   → RendicionesPage muestra en tiempo real lo cobrado (filtra por cobrador_id + fecha)

3. Al volver: cobrador POST route-sessions/{id}/close con:
   { efectivo_declarado, items: [{tipo, numero, banco, monto, customer_id}] }
   → service calcula efectivo_esperado = sum(rp.monto) WHERE tipo='efectivo' AND cobrador_id AND fecha
   → service calcula total_cobrado_ar = sum de todos los pagos del cobrador del día
   → route_liquidation creada con estado "pendiente"

4. Supervisor revisa en LiquidacionesPage:
   → Ve reconciliación: esperado vs declarado, diferencia
   → POST authorize / observe / reject
   → Si observe: cobrador ve la nota en RendicionesPage, puede responder (por observaciones)

5. Tesorero al final del día:
   → GET treasury/daily-summary: agrega liquidaciones autorizadas + vault retail
   → POST treasury/bank-deposit: registra la boleta bancaria
```

## Casos borde

1. **Cobrador sin sesión abierta registra cobros:** Permitido — cobros en AR no dependen de la sesión. RendicionesPage muestra "Sin sesión hoy — contactá al supervisor".
2. **Diferencia negativa** (trae más efectivo del esperado): Válido. Sistema muestra en verde. Supervisor autoriza con observación opcional.
3. **Sesión del día anterior sin cerrar:** POST route-sessions devuelve 409 con mensaje "Sesión abierta del [fecha] pendiente de cierre". Supervisor debe resolver antes.
4. **Cobrador sin ruta o con múltiples rutas:** route_id nullable. Una sesión por día cubre todas las rutas del cobrador (igual que el legacy).
5. **Liquidación observada sin respuesta del cobrador:** Supervisor puede autorizar o rechazar directamente sin esperar aclaración.

## Permisos

Se integra al sistema de permisos existente (claims en JWT):

| Acción | Rol requerido |
|---|---|
| Ver propia sesión del día | `cobrador` (filtra por sub del JWT) |
| Cerrar/declarar sesión | `cobrador` (solo la propia) |
| Abrir sesiones, autorizar, observar, rechazar | `supervisor_cobranzas` |
| Treasury daily summary + bank deposit | `tesorero` |
| Todo | `admin` |

## Integración con módulos existentes

- **AccountsReceivable / receivable_payments:** fuente de verdad del efectivo cobrado. El service de ruta_caja hace SELECT sobre receivable_payments WHERE cobrador_id = ? AND fecha = ?
- **pagare_payments:** idem para pagarés
- **delivery_notes:** idem para NCs aplicadas
- **routes:** route_id FK para filtrar sesiones por ruta (ya existe el modelo)
- **CashSession (módulo caja):** solo lectura en TesoreriaPage para el panel retail — no se modifica el módulo caja

## Testing

Tests backend (`tests/test_ruta_caja.py`):
- `test_open_route_session_assigns_fondo`
- `test_cannot_open_second_session_same_cobrador_same_day`
- `test_close_session_calculates_efectivo_esperado_from_ar`
- `test_authorize_liquidation_sets_estado_autorizada`
- `test_observe_liquidation_adds_note`
- `test_treasury_daily_summary_aggregates_authorized_liquidations`

TypeScript: `npx tsc --noEmit` sin errores propios en los archivos nuevos.

## Review Focus

1. **Cobrador sin pagos en AR ese día** — efectivo_esperado = 0, diferencia = efectivo_declarado. El sistema no debe rechazar ni marcar como error — puede haber cobrado todo en pagarés.
2. **Cobrador registra cobros en AR sin sesión abierta** — los cobros existen pero no hay sesión. Al abrir sesión retroactiva (mismo día), el cierre debe capturar esos cobros correctamente.
3. **Depósito bancario parcial** — tesorero puede querer depositar solo algunas liquidaciones y dejar otras para mañana. `route_liquidation_ids` en bank_deposits no debe requerir todas las autorizadas del día.
4. **Zona horaria en cálculo AR** — el filtro `fecha = today` debe usar `America/Asuncion`. La DB está configurada con `timezone=America/Asuncion` en connect_args (ver api/src/db.py), pero el query explícito debe usar `AT TIME ZONE` o date-cast correcto.
5. **Concurrencia al autorizar** — si dos supervisores autorizan la misma liquidación simultáneamente, el segundo UPDATE debe detectar que estado ya no es "pendiente" y devolver 409.
