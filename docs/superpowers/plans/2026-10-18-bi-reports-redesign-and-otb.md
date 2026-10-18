# Plan de Implementación: Rediseño de BI y Módulo Retail de Compras vs. Ventas (OTB)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar la navegación de Business Intelligence en 3 categorías maestras, estabilizar la altura fija de KPIs, incorporar en Ventas por Proveedor el KPI de "Monto Pagado" con selector temporal comparado al CMV, y añadir el informe estándar Retail de "Compras vs. Ventas" (Open To Buy) con cálculo de ratio, semáforo de sobrecompra y exportación PDF/Excel.

**Architecture:** 
1. **Backend**: Nuevos endpoints en `api/src/reports/` para obtener pagos a proveedores (`/sales/by-supplier/payments-summary`) y consolidar compras vs. ventas (`/purchases-vs-sales`), más sus exportadores en PDF (con membrete fiscal) y Excel.
2. **Frontend**: Refactorizar `ReportsPage.tsx` con tabs maestros categorizados (`Rentabilidad`, `Compras & Proveedores`, `Caja & Auditoría`), aislar la grilla de KPIs contextual por pestaña para evitar saltos, enriquecer la vista de proveedores y crear el tab `ComprasVsVentasTab.tsx`.

**Architecture Diagram:**
```mermaid
graph TD
    subgraph Frontend [ReportsPage.tsx]
        Nav[Barra Categorizada en 3 Grupos]
        Nav --> Cat1[1. Rentabilidad Comercial]
        Nav --> Cat2[2. Compras & Proveedores]
        Nav --> Cat3[3. Caja & Auditoría]
        
        Cat2 --> TabProv[Ventas por Proveedor]
        Cat2 --> TabOTB[Compras vs. Ventas OTB]
        
        TabProv --> KpiPagos[KPI Monto Pagado vs. CMV]
        TabOTB --> KpiOTB[KPI Ratio C/V & Semáforo]
    end

    subgraph Backend [FastAPI api/src/reports/]
        R1[/api/reports/sales/by-supplier/payments-summary]
        R2[/api/reports/purchases-vs-sales]
        R3[/api/reports/export/purchases-vs-sales.pdf]
        R4[/api/reports/export/purchases-vs-sales.xlsx]
    end

    TabProv --> R1
    TabOTB --> R2
    TabOTB --> R3
    TabOTB --> R4
```

**Tech Stack:** React, Tailwind CSS, TypeScript, FastAPI, SQLAlchemy, ReportLab (PDF), openpyxl (XLSX).

**Spec:** [docs/superpowers/specs/2026-10-18-bi-reports-redesign-and-otb-spec.md](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/docs/superpowers/specs/2026-10-18-bi-reports-redesign-and-otb-spec.md)

## Global Constraints
- Zona horaria mandatoria: `America/Asuncion` (Paraguay).
- Moneda principal: Guaraníes (PYG) sin decimales en montos finales.
- Zero-downtime deploys: `bash deploy-ui.sh` y `bash deploy-api.sh`.
- Prohibido tocar POS o Electron.

---

### Task 1: Backend - Endpoint de Resumen de Pagos por Proveedor
**Files:**
- Modify: `api/src/reports/router.py`
- Modify: `api/src/reports/service.py`
- Test: `api/tests/test_supplier_payments_summary.py`

**Interfaces:**
- Produces: `GET /api/reports/sales/by-supplier/payments-summary`
- Retorna: `{ "supplier_id": str, "monto_pagado_mes": float, "monto_pagado_historico": float }`

- [ ] **Step 1: Escribir test unitario/integración para el cálculo de pagos por proveedor**
- [ ] **Step 2: Ejecutar test para verificar que falla antes de implementar**
- [ ] **Step 3: Implementar función `get_supplier_payments_summary` en `service.py` y registrar ruta en `router.py`**
- [ ] **Step 4: Ejecutar test y verificar que pasa exitosamente**
- [ ] **Step 5: Commit del cambio**

---

### Task 2: Backend - Endpoint de Compras vs. Ventas (OTB) y Exportadores
**Files:**
- Modify: `api/src/reports/router.py`
- Modify: `api/src/reports/service.py`
- Modify: `api/src/reports/export_service.py`
- Modify: `api/src/reports/pdf_reports.py`
- Test: `api/tests/test_purchases_vs_sales_report.py`

**Interfaces:**
- Produces: `GET /api/reports/purchases-vs-sales?fecha_desde=...&fecha_hasta=...&target_ratio_pct=...`
- Produces: `GET /api/reports/export/purchases-vs-sales.pdf` y `.xlsx`

- [ ] **Step 1: Escribir test para la agregación de compras vs. ventas por período**
- [ ] **Step 2: Implementar consulta SQL y agregación en `service.py`**
- [ ] **Step 3: Implementar generador de PDF con membrete fiscal y exportador Excel en `pdf_reports.py` y `export_service.py`**
- [ ] **Step 4: Ejecutar pruebas y verificar generación de reportes**
- [ ] **Step 5: Commit del cambio**

---

### Task 3: Frontend - Reorganización de Navegación de Pestañas y Fijación de KPIs
**Files:**
- Modify: `ui-web/src/pages/reports/ReportsPage.tsx`

- [ ] **Step 1: Crear estructura de tabs principales (Rentabilidad, Compras & Proveedores, Caja & Auditoría)**
- [ ] **Step 2: Desacoplar la condición que ocultaba los 4 KPIs superiores para eliminar el salto visual**
- [ ] **Step 3: Contextualizar los KPIs según la pestaña activa (evitar repetición de datos)**
- [ ] **Step 4: Verificar en navegador la estabilidad del layout**
- [ ] **Step 5: Commit del cambio**

---

### Task 4: Frontend - KPI de Monto Pagado al Proveedor con Selector Temporal
**Files:**
- Modify: `ui-web/src/pages/reports/ReportsPage.tsx`
- Modify: `ui-web/src/api/reports.ts`

- [ ] **Step 1: Conectar método `getSupplierPaymentsSummary` en el cliente API de frontend**
- [ ] **Step 2: Reemplazar el KPI redundante de Unidades por la tarjeta interactiva de Monto Pagado vs. CMV**
- [ ] **Step 3: Implementar el selector dropdown `[Este Mes | Total Histórico]` con cálculo dinámico de cobertura**
- [ ] **Step 4: Validar visualmente la reactividad y cálculos**
- [ ] **Step 5: Commit del cambio**

---

### Task 5: Frontend - Creación del Componente y Tab "Compras vs. Ventas (OTB)"
**Files:**
- Create: `ui-web/src/pages/reports/ComprasVsVentasTab.tsx`
- Modify: `ui-web/src/pages/reports/ReportsPage.tsx`

- [ ] **Step 1: Diseñar el componente `ComprasVsVentasTab.tsx` con KPIs de Ratio C/V, barra de progreso presupuestario y semáforo**
- [ ] **Step 2: Implementar el control editable de Porcentaje Techo de Compras**
- [ ] **Step 3: Integrar gráfico comparativo temporal y tabla de compras vs. ventas por proveedor**
- [ ] **Step 4: Conectar los botones de exportación a PDF y Excel con membrete oficial**
- [ ] **Step 5: Commit del cambio**

---

### Task 6: Verificación Integral, Build y Despliegue Zero-Downtime
- [ ] **Step 1: Compilar frontend (`npm run build`) para verificar tipos y bundling**
- [ ] **Step 2: Desplegar API en producción con `bash deploy-api.sh`**
- [ ] **Step 3: Desplegar UI en producción con `bash deploy-ui.sh`**
- [ ] **Step 4: Verificación final en vivo**
