# Roadmap Distribuidora — Casa Gonzalito

> Archivo de referencia persistente. Actualizar al terminar cada sub-proyecto.
> Leer SIEMPRE al inicio de una sesión en vertical/distribuidora para saber dónde estamos.

## Estado General

| # | Sub-proyecto | Estado | Notas |
|---|---|---|---|
| 1 | Rutas y Vendedores de Campo | ✅ COMPLETO | Commits 283edd38..cf8de36b. Deploy pendiente confirmación |
| 2 | Gestión de Crédito y Cobranzas | ✅ COMPLETO + DEPLOY | Commits b5a4b054..7ce6cda8. Migración aplicada en minisforum-ia |
| 3 | Liquidaciones de Cobrador (Cajas de Ruta) | ✅ COMPLETO + DEPLOY | Commits 794cf01a..7635704e. Tablas y API en producción 15-oct-2026 |
| 4 | Compras e Inventario | ✅ COMPLETO | Commits ecc67a27..0bc85d6f. Reglas proveedor, forecast, SIFEN, muelle, pesaje camión |
| 5 | Logística / Reparto | ⬜ PENDIENTE | Sin spec ni plan |
| 6 | Contabilidad | ⬜ PENDIENTE | Sin spec ni plan — 3.26M asientos desde 2007 |

## Sub-proyecto 1: Rutas y Vendedores de Campo ✅

**Plan:** `docs/superpowers/plans/2026-10-12-rutas-vendedores-campo.md`  
**Ledger:** `.superpowers/sdd/2026-10-12-rutas-vendedores-campo/progress.md`

Entregables:
- Migración DB: `lat/lng/geocoded_at` en `customers` (20261012100000)
- Script geocodificación batch (`scripts/geocode_customers.py`)
- Endpoints: `GET /distribuidora/map/routes`, `GET /distribuidora/map/customers`
- Endpoint: `GET /distribuidora/performance/sellers`
- `MapaPage.tsx` reescrito con Google Maps JS API (3 capas: rutas, clientes, vendedores)
- `RutasPage.tsx`: botón optimizar orden de ruta (TSP)
- `RendimientoVendedoresPage.tsx`: tabla con métricas, sparklines, exportación CSV

Variables de entorno requeridas en VM:
- `GOOGLE_MAPS_API_KEY` en `api/src/config.py` (ya declarado, commit 0e9b3798)
- `VITE_GOOGLE_MAPS_KEY` en `ui-web/.env.local` del servidor (NO en git)

Deploy: `scripts/geocode_customers.py` se corre una vez para geocodificar clientes existentes.

## Sub-proyecto 2: Gestión de Crédito y Cobranzas ✅

**Plan:** `docs/superpowers/plans/2026-10-13-credito-cobranzas-distribuidora.md`  
**Ledger:** `.superpowers/sdd/2026-10-13-credito-cobranzas-distribuidora/progress.md`

Entregables:
- Tablas: `pagares`, `pagare_payments`, `delivery_notes`, `receivable_payments` + extensiones AR
- Módulo backend: pagarés (CRUD, cobro, protesto)
- Módulo backend: delivery notes / NC de entrega (5 conceptos)
- Extensiones AR: cobrador, by-route, cheque bounce, cobro con NC
- Frontend: tabs Pagarés, Notas de Crédito, Por Ruta en `AccountsReceivablePage`

Migración aplicada: `20261013110000` en minisforum-ia ✅

## Sub-proyecto 3: Liquidaciones de Cobrador (Cajas de Ruta) 📝

**Spec:** `docs/superpowers/specs/2026-10-14-caja-ruta-tesoreria-design.md`

**Diseño aprobado (14-oct-2026):**
- Módulo nuevo `api/src/ruta_caja/` (independiente del módulo `caja` retail)
- 4 tablas: `route_sessions`, `route_liquidations`, `route_liquidation_items`, `bank_deposits`
- 3 páginas: `RendicionesPage` (cobrador, responsive), `LiquidacionesPage` (supervisor), `TesoreriaPage` (tesorero, unifica rutas + retail)
- 10 endpoints bajo `/api/v1/distribuidora/`
- Reconciliación híbrida: sistema calcula esperado desde AR, cobrador declara, supervisor autoriza

Siguiente paso: invocar `superpowers:writing-plans` → ejecutar plan.

## Sub-proyecto 4: Compras e Inventario ⬜

**Plan existente:** `docs/superpowers/plans/2026-09-28-compras-inteligentes-proveedores-plan.md`  
**Spec:** `docs/superpowers/specs/2026-09-28-compras-inteligentes-proveedores-design.md`

Plan listo pero sin ledger (nunca ejecutado). Revisar el plan antes de iniciar.

Siguiente paso: leer el plan y ejecutar con `superpowers:executing-plans`.

## Sub-proyecto 5: Logística / Reparto ⬜

Asignación de camiones y choferes a rutas, registro de viajes (km salida/llegada), historial de entregas.

Siguiente paso: brainstorm → spec → plan → ejecutar.

## Sub-proyecto 6: Contabilidad ⬜

3.26M asientos desde 2007. UI para plan de cuentas, libro diario, balances, estado de resultados.

El más pesado. Dejar para último o hacer por partes (balance → diario → etc.)

Siguiente paso: brainstorm → spec → plan → ejecutar.

---

## Contexto de infra

- **VM:** `intellihouse@minisforum-ia` (Tailscale)
- **API dual:** api-1 en :8000, api-2 en :8010
- **Restart sin caída:** reiniciar api-2 primero, luego api-1
- **Build UI:** `cd ui-web && npm run build` en la VM
- **JWT secreto por defecto:** PENDIENTE CRÍTICO — producción firma con secreto default
