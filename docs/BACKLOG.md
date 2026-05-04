# BACKLOG — InteliMarket

## Épicos

### E1: Plataforma Base
- **Prioridad:** P0
- **Descripción:** Fundamentos del SaaS: infraestructura, auth, multi-tenancy, configuración
- **Dependencias:** Ninguna
- **Sprint objetivo:** 1-4

### E2: Catálogo de Productos
- **Prioridad:** P0
- **Descripción:** Gestión completa de productos, categorías, variantes, precios, descuentos
- **Dependencias:** E1
- **Sprint objetivo:** 3-6

### E3: Inventario
- **Prioridad:** P0
- **Descripción:** Multi-almacén, stock, movimientos, lotes, series, transferencias, costeo
- **Dependencias:** E2
- **Sprint objetivo:** 5-8

### E4: Ventas y POS
- **Prioridad:** P0
- **Descripción:** Punto de venta, ventas, cotizaciones, caja, clientes
- **Dependencias:** E2, E3
- **Sprint objetivo:** 7-10

### E5: Facturación SIFEN
- **Prioridad:** P0
- **Descripción:** Emisión e-Kuatia, CDC, timbrados, respuestas, compliance
- **Dependencias:** E4
- **Sprint objetivo:** 9-12

### E6: Compras y Proveedores
- **Prioridad:** P1
- **Descripción:** Órdenes de compra, recepción, proveedores, histórico
- **Dependencias:** E3
- **Sprint objetivo:** 11-14

### E7: Cobros y Pagos
- **Prioridad:** P1
- **Descripción:** Medios de pago, split payments, wallet, crédito, financiamiento, pasarelas
- **Dependencias:** E4
- **Sprint objetivo:** 12-16

### E8: Distribución
- **Prioridad:** P1
- **Descripción:** Pedidos B2B, logística, entregas, CRM básico
- **Dependencias:** E4, E6
- **Sprint objetivo:** 15-18

### E9: Integraciones Ecosistema
- **Prioridad:** P1
- **Descripción:** InteliCont, InteliAudit, SueldOK
- **Dependencias:** E5, E6, E7
- **Sprint objetivo:** 17-20

### E10: Reportes y Dashboard
- **Prioridad:** P1
- **Descripción:** Dashboard KPIs, reportes fiscales, exportación
- **Dependencias:** E4, E5, E6, E7
- **Sprint objetivo:** 18-22

### E11: Landing + Billing
- **Prioridad:** P2
- **Descripción:** Landing page, registro, planes, billing, feature flags
- **Dependencias:** E1-E10 (MVP funcional)
- **Sprint objetivo:** 21-24

### E12: Launch
- **Prioridad:** P2
- **Descripción:** Hardening, performance, seguridad, tests, deploy producción
- **Dependencias:** E1-E11
- **Sprint objetivo:** 23-26

---

## Tareas detalladas

### E1: Plataforma Base

#### E1.1 Infraestructura
| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E1.1.1 | Docker compose (PostgreSQL, Redis, API, Frontend) | 2d | ⬜ |
| E1.1.2 | CI/CD GitHub Actions (lint, test, build) | 2d | ⬜ |
| E1.1.3 | Alembic setup con migraciones | 1d | ⬜ |
| E1.1.4 | Nginx reverse proxy config | 1d | ⬜ |

#### E1.2 Multi-tenancy
| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E1.2.1 | Schema provisioning automático | 3d | ⬜ |
| E1.2.2 | Tenant resolution middleware | 2d | ⬜ |
| E1.2.3 | Tablas master (tenants, users, subscriptions) | 2d | ⬜ |
| E1.2.4 | Tablas tenant (schema por tenant) | 2d | ⬜ |

#### E1.3 Auth
| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E1.3.1 | JWT setup (access + refresh) | 2d | ⬜ |
| E1.3.2 | Login/Register API | 2d | ⬜ |
| E1.3.3 | MFA (TOTP) | 3d | ⬜ |
| E1.3.4 | RBAC middleware | 2d | ⬜ |
| E1.3.5 | Frontend auth context + login page | 2d | ⬜ |

#### E1.4 Audit Trail
| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E1.4.1 | Audit log model + middleware | 2d | ⬜ |
| E1.4.2 | Frontend audit log viewer | 2d | ⬜ |

---

### E2: Catálogo de Productos

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E2.1 | Product categories CRUD + API + UI | 2d | ⬜ |
| E2.2 | Products CRUD + API + UI | 3d | ⬜ |
| E2.3 | Product variants | 2d | ⬜ |
| E2.4 | Price lists CRUD | 2d | ⬜ |
| E2.5 | Product prices por lista | 2d | ⬜ |
| E2.6 | Discounts CRUD | 2d | ⬜ |
| E2.7 | Barcode scanner integration (web) | 2d | ⬜ |
| E2.8 | Bulk import/export (Excel) | 3d | ⬜ |

---

### E3: Inventario

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E3.1 | Warehouses CRUD | 1d | ⬜ |
| E3.2 | Stock tracking | 2d | ⬜ |
| E3.3 | Inventory movements (entradas/salidas) | 3d | ⬜ |
| E3.4 | Costeo promedio ponderado | 2d | ⬜ |
| E3.5 | Costeo FIFO | 3d | ⬜ |
| E3.6 | Batch management (lotes + vencimientos) | 3d | ⬜ |
| E3.7 | Serial numbers | 2d | ⬜ |
| E3.8 | Stock transfers | 3d | ⬜ |
| E3.9 | Inventory adjustments (con aprobación) | 2d | ⬜ |
| E3.10 | Stock minimum alerts | 1d | ⬜ |
| E3.11 | Real-time stock via WebSocket | 2d | ⬜ |

---

### E4: Ventas y POS

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E4.1 | Customers CRUD + API + UI | 2d | ⬜ |
| E4.2 | Sales CRUD + API | 3d | ⬜ |
| E4.3 | Sale items (cart) | 2d | ⬜ |
| E4.4 | POS interface (PWA) | 5d | ⬜ |
| E4.5 | Cash register management | 3d | ⬜ |
| E4.6 | Cash sessions (apertura/cierre/arqueo) | 3d | ⬜ |
| E4.7 | Quotes (cotizaciones) | 2d | ⬜ |
| E4.8 | Returns / credit notes | 3d | ⬜ |
| E4.9 | POS offline (Service Worker + IndexedDB) | 5d | ⬜ |
| E4.10 | Print tickets (WebUSB/WebSerial) | 3d | ⬜ |
| E4.11 | Promotions in POS | 2d | ⬜ |

---

### E5: Facturación SIFEN

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E5.1 | XML e-Kuatia generator | 4d | ⬜ |
| E5.2 | CDC calculation | 3d | ⬜ |
| E5.3 | SIFEN API client | 3d | ⬜ |
| E5.4 | Response processing | 2d | ⬜ |
| E5.5 | Timbrado management | 2d | ⬜ |
| E5.6 | Invoice → SIFEN flow completo | 3d | ⬜ |
| E5.7 | CDC validation endpoint | 1d | ⬜ |
| E5.8 | External issuer webhook | 2d | ⬜ |
| E5.9 | Sales book (Libro IVA ventas) | 2d | ⬜ |
| E5.10 | Purchase book (Libro IVA compras) | 2d | ⬜ |
| E5.11 | RG 90 detail generation | 3d | ⬜ |
| E5.12 | Fiscal validations middleware | 3d | ⬜ |

---

### E6: Compras y Proveedores

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E6.1 | Suppliers CRUD | 2d | ⬜ |
| E6.2 | Purchase orders | 3d | ⬜ |
| E6.3 | Purchase order items | 2d | ⬜ |
| E6.4 | Goods receipt | 3d | ⬜ |
| E6.5 | Receipt items + stock update | 2d | ⬜ |
| E6.6 | Supplier invoice linking | 2d | ⬜ |

---

### E7: Cobros y Pagos

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E7.1 | Payment methods config | 2d | ⬜ |
| E7.2 | Payments CRUD | 2d | ⬜ |
| E7.3 | Split payments | 3d | ⬜ |
| E7.4 | Customer wallets | 2d | ⬜ |
| E7.5 | Wallet transactions | 2d | ⬜ |
| E7.6 | Customer accounts (cuenta corriente) | 3d | ⬜ |
| E7.7 | Account movements | 2d | ⬜ |
| E7.8 | Financing (cuotas) | 4d | ⬜ |
| E7.9 | Financing installments tracking | 3d | ⬜ |
| E7.10 | Pagopar integration | 3d | ⬜ |
| E7.11 | Kuapay integration | 3d | ⬜ |

---

### E8: Distribución

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E8.1 | Delivery routes | 2d | ⬜ |
| E8.2 | Deliveries | 3d | ⬜ |
| E8.3 | Delivery slips (albaranes) | 2d | ⬜ |
| E8.4 | Signature capture | 2d | ⬜ |
| E8.5 | CRM: Opportunities | 2d | ⬜ |
| E8.6 | CRM: Pipeline | 2d | ⬜ |
| E8.7 | Quote → Sale conversion | 1d | ⬜ |
| E8.8 | Price lists by channel/volume | 2d | ⬜ |
| E8.9 | Minimum order per customer | 1d | ⬜ |

---

### E9: Integraciones Ecosistema

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E9.1 | InteliCont webhook: invoice.issued | 2d | ⬜ |
| E9.2 | InteliCont webhook: purchase.received | 2d | ⬜ |
| E9.3 | InteliCont webhook: payment.recorded | 2d | ⬜ |
| E9.4 | InteliCont webhook: period.closed | 2d | ⬜ |
| E9.5 | HMAC signature verification | 1d | ⬜ |
| E9.6 | InteliAudit monthly snapshot | 3d | ⬜ |
| E9.7 | InteliAudit findings query | 2d | ⬜ |
| E9.8 | SueldOK payroll pull | 2d | ⬜ |
| E9.9 | SueldOK employee push | 2d | ⬜ |

---

### E10: Reportes y Dashboard

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E10.1 | Dashboard KPIs | 3d | ⬜ |
| E10.2 | Sales reports | 3d | ⬜ |
| E10.3 | Inventory valuation report | 3d | ⬜ |
| E10.4 | Stock rotation report | 2d | ⬜ |
| E10.5 | Margin by product | 2d | ⬜ |
| E10.6 | Cash report | 2d | ⬜ |
| E10.7 | VAT sales book report | 2d | ⬜ |
| E10.8 | VAT purchase book report | 2d | ⬜ |
| E10.9 | Excel export (all reports) | 2d | ⬜ |
| E10.10 | PDF generation | 3d | ⬜ |

---

### E11: Landing + Billing

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E11.1 | Landing page | 3d | ⬜ |
| E11.2 | Pricing page | 1d | ⬜ |
| E11.3 | Trial registration | 2d | ⬜ |
| E11.4 | Plan system | 2d | ⬜ |
| E11.5 | Feature flags by plan | 2d | ⬜ |
| E11.6 | Limits enforcement | 2d | ⬜ |
| E11.7 | SaaS billing | 3d | ⬜ |
| E11.8 | Upgrade/downgrade flow | 2d | ⬜ |

---

### E12: Launch

| ID | Tarea | Estimación | Estado |
|----|-------|-----------|--------|
| E12.1 | Query optimization | 3d | ⬜ |
| E12.2 | Redis caching setup | 2d | ⬜ |
| E12.3 | Load testing | 2d | ⬜ |
| E12.4 | Pen testing | 3d | ⬜ |
| E12.5 | Automated backups | 1d | ⬜ |
| E12.6 | Unit tests (>= 80% coverage) | 5d | ⬜ |
| E12.7 | Integration tests | 3d | ⬜ |
| E12.8 | E2E tests (POS critical path) | 5d | ⬜ |
| E12.9 | UAT with beta testers | 5d | ⬜ |
| E12.10 | Production deployment | 2d | ⬜ |

---

## Leyenda de estado

- ⬜ No started
- 🔄 In progress
- ✅ Done
- ❌ Blocked
- ⏸️ Paused

## Prioridades

- **P0:** Crítico — sin esto no hay producto
- **P1:** Importante — sin esto no hay MVP completo
- **P2:** Deseable — post-MVP o nice-to-have
