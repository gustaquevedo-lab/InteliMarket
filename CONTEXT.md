# InteliMarket — Project Context

## Goal
- Build a modular SaaS ERP for Paraguayan distributors with configurable verticals — delivery management, WhatsApp CRM/campaigns/chatbot, glassmorphism React Native mobile apps, B2B marketplace, Supplier Portal, Marketing Automation, E-commerce Web, Advanced Inventory, Integrated Financial Management, SIFEN Avanzado, Smart Pricing, Demand Forecast, and Intelligent Routing.

## Constraints & Preferences
- Multi-tenant SaaS with feature flags (`ALL_FEATURES` = 57+ keys incl. `integrated_finance`, `sifen_avanzado`, `smart_pricing`, `demand_forecast`, `intelligent_routing`) and 3 plans (starter, pro, enterprise).
- Distributor vertical now has all 57+ features including latest `smart_pricing`, `demand_forecast`, `intelligent_routing`.
- Forecasting engine uses pure Python statistical models (exponential smoothing, moving average, seasonal decomposition) — Prophet/scikit-learn are optional extras.
- TSP solver uses nearest-neighbor + 2-opt with time window + capacity constraints — OR-Tools optional.
- ROADMAP.html `STATE_VERSION = 20` — Fase 4 completed (4/4), Fase 5 at 6/6 done.

## Progress
### Done
- **Smart Pricing (Gestión de Precios Inteligente)**: 8 models (PriceListAssignment, TieredPrice, Promotion, PromotionReward, PromotionAssignment, PriceSuggestion, PriceChangeRequest, PriceChangeHistory), service with 25+ functions (dynamic pricing algorithm, tiered calculator, 2-level approval workflow, promotion engine with 6 types). Router: 18 endpoints under `/api/v1/smart-pricing/`. Migration `20260601200000` (8 `sp_*` tables). Feature flag `smart_pricing`. Frontend `SmartPricingPage.tsx` with 6 tabs. Sidebar under "CRM & Marketing".
- **Demand Forecast (Forecast Inteligente de Demanda)**: 6 models (ForecastConfig, ForecastPrediction, ForecastOverride, AnomalyDetection, PurchaseSuggestion, ForecastAccuracy). 3 statistical forecast algorithms. Anomaly detection via Z-score. Purchase suggestions with lead time + safety stock. Accuracy tracking with MAPE/MAE/RMSE. Router: 15+ endpoints under `/api/v1/demand-forecast/`. Migration `20260601210000` (7 `df_*` tables). Feature flag `demand_forecast`. Frontend `DemandForecastPage.tsx` with 6 tabs. Sidebar under "IA & Analítica".
- **Intelligent Routing (Ruteo Inteligente para Repartidores)**: 6 models (RouteOptimization, VehicleLoadConfig, LoadOptimizationResult, DynamicRerouteRequest, EtaPrediction, RouteEfficiencyMetric). TSP solver (nearest-neighbor + 2-opt + time window/capacity constraints), vehicle load optimizer (volume/weight/pallets, temperature zones, LIFO/FIFO/zone ordering), dynamic re-routing, ETA prediction (haversine × zone × hour × traffic, 30-95% confidence), efficiency dashboard. Router: 12 endpoints under `/api/v1/intelligent-routing/`. Migration `20260601220000` (6 `ir_*` tables). Feature flag `intelligent_routing` registered in plans, presets, main.py, env.py. Frontend `IntelligentRoutingPage.tsx` with 5 tabs. Sidebar under "IA & Analítica".
- **Credit Scoring (Scoring de Crédito Automático)**: 3 models (CreditScore, RiskAlert, CreditEvent). Scoring algorithm with 6 components (payment history 0-300, antiquity 0-200, frequency 0-150, avg amount 0-150, industry 0-100, credit utilization 0-100 → total 0-1000, risk levels low/medium/high/critical). Suggested limit auto-calculated (3x/2x/1x/0.5x monthly avg purchase). 4 alert types (near_limit, overdue, score_drop, payment_default) with 4 severities. Auto block at score <300 or overdue >60 days. Auto unblock on re-evaluation. Monthly re-evaluation scheduling. Router: 13 endpoints under `/api/v1/credit-scoring/`. Migration `20260601230000` (3 `sc_*` tables). Feature flag `credit_scoring` registered. Frontend `CreditScoringPage.tsx` with 6 tabs. Sidebar under "IA & Analítica".
- **Oportunidades Comerciales**: 4 models (Opportunity, ProductAffinity, Recommendation, ChurnAnalysis). 5 detection algorithms: churn detection (score basado en días sin compra × frecuencia previa, risk levels low/medium/high/critical), dormant products (últimos 6 meses, descuento auto 5-20%), cross-selling (market basket analysis con support/confidence/lift, umbral lift ≥1.5), credit potential (clientes que pagan efectivo con potencial), up-selling (≥3 compras misma presentación, sugiere variante mayor). Router: 12 endpoints under `/api/v1/comerciales/`. Migration `20260601240000` (4 `co_*` tables). Feature flag `comerciales` registered. Frontend `OportunidadesPage.tsx` with 6 tabs. Sidebar under "IA & Analítica".
- **IoT Cadena de Frío**: 4 models (ColdSensor, SensorReading, ColdChainAlert, ComplianceLog). Sensor management with location, thresholds, battery, signal. Time-series readings with temperature/humidity. Real-time alerts on temp out of range or battery low. Compliance logs per batch/product with min/max/avg temp, violations count, DINALFA reports. MQTT simulation endpoint. WhatsApp notification for alerts. Router: 15+ endpoints under `/api/v1/cold-chain/`. Migration `20260601250000` (4 `cc_*` tables). Feature flag `cold_chain` registered. Frontend `ColdChainPage.tsx` with 6 tabs. Sidebar under "IA & Analítica".
- **Asistente Virtual IA** (av_*): 4 models (Conversation, Message, Ticket, IntentTemplate). NLU engine with pattern matching + 8 intent categories. Multi-channel: web chat + WhatsApp + voice. Human handoff with ticket creation. Analytics: response time, resolution rate, top intents. Router: 15+ endpoints. Migration `20260601260000`. Feature flag `asistente_virtual`. Frontend page (pending).
- **Supermercado Fase 1-3 + Retails Modules** (sm_*): Rotisería, HACCP, Auditorías, Equipos, DSD, Inventory, Replenishment, Returns, Pricing, ESL, Promos, Dynamic Markdown. Models with `sm_` prefix, migrations `20260601270000` to `20260601290000`.
- **Fidelización, Scan&Go, Customer360, Schedule, Productividad, Capacitación, PYG Diario, Shrinkage, Forecast Avanzado, Benchmarking, E-commerce SM** (cl_* + sm_* + c360_* + sch_* + pdp_* + tr_* + sm_pyg/sm_shr/sm_fore/sm_bench/sm_ecom). Migrations `20260601300000` to `20260601400000`.
- **Delivery App Integrations** (di_*): 5 tables. Feature flag `delivery_integrations`. Migration `20260601410000`. Frontend page with 5 tabs.
- **Suscripciones Recurrentes** (sr_*): 5 tables. Feature flag `suscripciones`. Migration `20260601420000`. Frontend page with 5 tabs + 20 productos demo.
- **ALEMBIC UPGRADE COMPLETED**: `alembic upgrade head` ran successfully. DB at version `20260601420000` (head). All 38 new tables created (sp_* + df_* + ir_* + sc_* + co_* + cc_* + av_* + sm_* + cl_* + c360_* + sch_* + pdp_* + tr_* + di_* + sr_*).
- **ROADMAP_SUPERMER.html** updated to STATE_VERSION 15 with Fase 7 3/3 complete.
- **ROADMAP_VERTICALS.html** (master multi-vertical) `STATE_VERSION = 10`, 6 verticals, ~1183 API paths, 313 DB tablas, alembic head 20260607000000. Servicios vertical: backend 2/2 done, frontend 0/2 pending. 25/28 modulos done, 2 in_progress.
- **Servicios Profesionales (sv_*) BACKEND COMPLETO 2/2 ✅**: 28 modelos (ServiceVertical, Skill, Technician, TechnicianSkill, TechnicianCertification, TechnicianAvailability, Team, TeamMember, ServiceZone, Property, Equipment, ServiceQuote, ServiceQuoteItem, ServiceQuotePhoto, Appointment, WorkOrder, WorkOrderItem, WorkOrderPhoto, TimeEntry, ServiceContract, ContractVisit, TruckInventory, ServiceInventoryMovement, ServiceInvoice, InvoicePayment, ServiceQuoteRequest, TechnicianReview, TechnicianMetrics). 45 endpoints `/api/v1/servicios/*` (dashboard ejecutivo, CRUD completos, AI dispatch scoring, contratos recurrentes, inventario móvil, facturación SIFEN, reviews, time tracking, lead capture). Migration `20260604000000_add_servicios_tables.py` aplicada. 8 feature flags (`servicios`, `servicios_agenda`, `servicios_contratos`, `servicios_dispatch`, `servicios_facturacion`, `servicios_inventario`, `servicios_portal`). Vertical registrado en `verticals/presets.py` con icon `wrench`. Seed completo: 15 service verticals (HVAC, plomería, electricidad, belleza, fitness, salud, automotriz, construcción, IT, pest_control, jardinería, limpieza, freelance, educación, veterinaria), 42 skills, 20 técnicos, 80 propiedades, 100 equipos, 30 quote requests, 20 quotes, 30 WO, 15 contratos + 164 visitas, 7 invoices, 88 truck inventory. AI dispatch scoring: `score = 100 - dist*0.5 - conflictos*20 + rating*5`. E2E test OK: POST `/quotes` → `CT-2026-0A5353` → 200. Frontend React page **PENDIENTE**.
- **Boutique/Indumentaria (bout_*) BACKEND COMPLETO ✅**: 25 modelos (bout_sizes, bout_colors, bout_categories, bout_collections, bout_products, bout_product_variants, bout_stock_movements, bout_sales, bout_sale_items, bout_returns, bout_return_items, bout_client_profiles, bout_client_interactions, bout_client_documents, bout_loyalty_config, bout_loyalty_tiers, bout_loyalty_accounts, bout_markdown_rules, bout_markdown_items, bout_product_ar, bout_gift_wrapping, bout_client_measurements, bout_events, bout_event_guests). 55 endpoints bajo `/api/v1/boutique/*` (dashboard, talles, colores, categorías jerárquicas, colecciones, productos con matriz variante size×color, ventas, devoluciones, clienteling con perfil+interacciones+documentos+medidas, loyalty 4 tiers con multiplicadores, markdown IA progresivo, AR try-on metadata, cross-selling, eventos con invitados, gift wrapping). Migration `20260607000000_add_boutique_tables.py` aplicada (25 tablas). 10 feature flags `boutique_*` registrados en plans.py/presets.py/main.py/env.py. DB total: 313 tablas (288 previas + 25). API total: ~1183 paths. Frontend React page **PENDIENTE**.

### In Progress
- **Servicios Profesionales FRONTEND 0/2**: falta crear `ui-web/src/api/servicios.ts`, `ui-web/src/pages/servicios/ServiciosPage.tsx` con tabs (Dashboard/Técnicos/Calendario/Cotizaciones/WO/Contratos/Inventario), agregar nav item a `Layout.tsx` y route en `App.tsx`
- **Boutique FRONTEND 0/2**: falta crear `ui-web/src/api/boutique.ts`, `ui-web/src/pages/boutique/BoutiquePage.tsx` con tabs (Dashboard/Productos/Ventas/Clientes/Loyalty/Markdown/Eventos), agregar nav item y route

### Blocked
- *(ninguno)*
  - `supermer/models.py:437` `RotiseriaBatch(models_base)` → `Base` + alias `RotiseriaRecipe`
  - `ecommerce/models.py:110` `metadata` → `payment_metadata = Column("metadata", JSON)` (reservado)
  - `ecommerce/auth.py:44-46` `db: AsyncSession = None` → `Depends(get_db)`
  - `supermer/service_*.py` (10 archivos) eliminado import inválido `get_tenant_db`
  - `supermer/models.py` aliases: `AuditTemplate`, `MaintenanceSchedule`, `WorkOrder`, etc.
  - `auth/deps.py` re-export `get_current_user`
  - `marketing/service.py:431` `count_t` con `await` → `async def`
  - `integrated_finance/service.py:495` `Sale` import movido al top
  - `integrated_finance/router.py:199-210` `Query()` → `Path()` para path params
  - `sifen_avanzado/models.py:45` `metadata` → `document_metadata`
  - `supplier_portal/models.py:4` `ForeignKey` import
  - `customers/models.py` alias `Partner = Customer`
  - `customer360/service.py:567` `_upsert_lifecycle` → `async def`
  - `products/models.py` alias `Category = ProductCategory`
  - `main.py:258-264` 6 nuevos `app.include_router()` para marketing, data_migration, distribuidora (×2), intelientregas_fase2, client_app
  - `main.py:259` `app.include_router(financial_router)` faltante

## Key Decisions
- **Smart Pricing extends** existing `price_lists/` module — adds assignments (cliente/grupo/canal/zona), tiered pricing, promotions, AI suggestions, approval workflow, audit history.
- **Demand Forecast uses pure Python stats** — exponential smoothing with level+trend, moving average with seasonal adjustment, seasonal decomposition. Prophet/scikit-learn optional. Falls back to synthetic data for demo when no sales history exists.
- **TSP solver uses heuristic** — nearest-neighbor + 2-opt (one pass). Time window violations penalized 10000, capacity violations penalized.
- **ETA factors**: zone (centro=1.4×, rural=0.9×), time-of-day (rush 1.3×, night 0.8×), day-of-week (weekend 0.9×). Base speed 30 km/h.
- **Vehicle load** groups by temperature zone (refrigerated on top for LIFO, ambient at bottom). Mixed zones without refrigeration → warning.
- **Boutique prefix**: `bout_*` consistente con naming de módulos.
- **Matriz variante**: `BoutiqueProductVariant` con `size_id`+`color_id` opcionales, stock y precio_sobrecargo.
- **Markdown IA**: algoritmo progresivo (% descuento × días restantes × rotación stock).
- **Clienteling**: perfil con interacciones + documentos + medidas corporales adjuntos.
- **Loyalty**: 4 tiers (Bronze/Plata/Oro/Platino) con multiplicadores acumulación/canje.
- **No usar `delete-orphan` en lado "many" de relationship** — rompe mapper global de SQLAlchemy, afecta login y todas las queries.
- **No usar `backref` en self-referential relationship** — causa recursión en mapper. Usar `back_populates` explícito.
- **Usar Pydantic schemas siempre para inputs** — evita errores de coerción (datetimes, UUIDs) al pasar dicts crudos.
- **`model_dump(exclude=...)`** cuando se pasa un schema cuyos campos se sobreescriben con valores calculados.

## Next Steps
1. **Boutique frontend** — crear `ui-web/src/api/boutique.ts`, `ui-web/src/pages/boutique/BoutiquePage.tsx` con tabs (Dashboard/Productos/Ventas/Clientes/Loyalty/Markdown/Eventos), nav item en Layout.tsx, route en App.tsx
2. **Servicios frontend** — `ui-web/src/api/servicios.ts`, `ServiciosPage.tsx` con tabs (Dashboard/Técnicos/Calendario/Cotizaciones/WO/Contratos/Inventario)
3. **Seed boutique** — `scripts/seed_boutique.py` con datos realistas moda Paraguay (100+ productos, clientes, loyalty, eventos)
4. **Update ROADMAP_VERTICALS.html** a STATE_VERSION 10
5. **Add automated tests** (critical gap)

## Critical Context
- Alembic current head: `20260607000000` (boutique). All migrations applied.
- DB has 313 tables (288 previas + 25 bout_*).
- API ~1183 paths (1128 previas + 55 boutique).
- Container `intelimarket-api` stable, API on port 8000, login admin@supermer.com/admin123.
- `api/src` is volume-mounted — code changes are live, restart required for new endpoints/imports.
- Boutique module: models, schemas, service, router, migration, plans/presets/main/env all done.
- `delete-orphan` cascade on "many" side of relationship breaks global SQLAlchemy mapper — avoid.
- `backref` on self-referential relationship causes mapper recursion — use `back_populates`.
- Pydantic schemas required for inputs with datetime/UUID fields — raw dicts fail SQLAlchemy coercion.
- `model_dump(exclude={...})` when schema fields would be overridden by computed values.

## Relevant Files
- `api/src/boutique/`: 5 files (__init__.py, models.py, schemas.py, service.py, router.py) — 25 modelos, 55 endpoints.
- `api/alembic/versions/20260607000000_add_boutique_tables.py`: migración boutique.
- `ui-web/src/pages/*`: 14+ frontend pages for new modules.
- `ROADMAP_VERTICALS.html`: STATE_VERSION 9, master multi-vertical roadmap.
- `CONTEXT.md`: this file.
