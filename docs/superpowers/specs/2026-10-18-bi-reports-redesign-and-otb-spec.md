# Especificación Técnica: Rediseño de Business Intelligence & Módulo Retail de Compras vs. Ventas (OTB)

**Fecha:** 2026-10-18  
**Proyecto:** Intelimarket (Vertical Supermercado - Extra Supermercado / Grupo Santa Teresa E.A.S.)  
**Módulo:** Business Intelligence & Informes Ejecutivos (`ui-web/src/pages/reports/ReportsPage.tsx` y `api/src/reports/`)

---

## 1. Objetivos del Cambio

1. **Eliminar la inestabilidad de navegación y saltos visuales**: Los KPIs ya no se alternarán arbitrariamente arriba y abajo de la barra de pestañas al cambiar de vista. La cabecera y la barra de navegación se mantendrán fijas y estables.
2. **Reorganizar las 8 pestañas en 3 Grupos Temáticos Claros**:
   - **Grupo 1: Rentabilidad Comercial** (7 Líneas de Utilidad, Familias & Categorías).
   - **Grupo 2: Compras & Proveedores** (Ventas por Proveedor & Liquidación, Compras vs. Ventas / OTB).
   - **Grupo 3: Auditoría & Operaciones de Caja** (Planilla Detallada por Día, Consolidado Diario, Medios de Pago & Gaveta, Rendimiento por Cajera).
3. **Auditar y contextualizar los KPIs**: Eliminar duplicaciones innecesarias donde se repetían los mismos datos globales y locales. Los KPIs superiores responderán con pertinencia a la sección activa.
4. **KPI "Monto Pagado a Proveedor" en Ventas por Proveedor**:
   - Con selector / dropdown: `Total Acumulado` vs. `Este Mes`.
   - Comparación directa con el `CMV de lo Vendido` para conocer si el proveedor está al día, si hay saldo pendiente por liquidar sobre sus ventas, o si hay sobrepago.
5. **Nuevo Informe Estándar de Retail: "Compras vs. Ventas por Período" (Open to Buy - OTB)**:
   - Control de techo presupuestario de compras para evitar que las recepciones superen un porcentaje objetivo de las ventas.
   - Semáforo de salud financiera (🟢 En Presupuesto / 🔴 Sobrecomprado).
   - Visualización evolutiva temporal y tabla detallada.
   - Exportación oficial a **PDF imprimible** (con membrete fiscal) y **Excel**.

---

## 2. Arquitectura de Navegación & Layout Fijo

### 2.1. Estructura Jerárquica de la Pantalla
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ BANNER SUPERIOR FISCAL & CONTROL DE PERÍODO                                            │
│ [Selector de Fechas: Mes Actual | Hoy | 7D | Custom]     [Actualizar] [PDF] [Excel]    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BARRA DE CATEGORÍAS PRINCIPALES (Segmented Pills):                                     │
│ [ 📈 Rentabilidad Comercial ]   [ 🏢 Compras & Proveedores ]   [ 🧾 Caja & Auditoría ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ SUB-PESTAÑAS DE LA CATEGORÍA ACTIVA:                                                   │
│ Si "Compras & Proveedores":                                                            │
│   • [ Ventas por Proveedor & Pagos ]      • [ Compras vs. Ventas (Presupuesto OTB) ]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ KPIS FIJOS DE LA SECCIÓN (Siempre en la misma posición relativa, sin empujar tabs)      │
│ [ KPI 1 ]            [ KPI 2 ]             [ KPI 3 ]            [ KPI 4 ]              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ CONTENIDO ESPECÍFICO (Tablas, Gráficos, Desgloses de Artículos)                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Mapa de Pestañas Agrupadas

| Grupo Principal | Pestaña Hija | Clave (`TabKey`) | KPIs Específicos |
| :--- | :--- | :--- | :--- |
| **Rentabilidad Comercial** | Ventas con Utilidad (7 Líneas) | `utilidad_7_lineas` | Total Ventas, CMV, Utilidad Bruta, Margen Neto % |
| | Familias & Categorías | `categorias` | Venta por Sección, Top Familia, Margen Ponderado, Ticket Medio |
| **Compras & Proveedores** | Ventas por Proveedor | `proveedores` | Venta Proveedor, CMV Vendido, **Monto Pagado (Dropdown)**, Saldo / Liquidación |
| | **Compras vs. Ventas (Nuevo)** | `compras_vs_ventas` | Total Ventas, Total Compras, Ratio Compras/Ventas %, Saldo Disponible (OTB) |
| **Caja & Auditoría** | Planilla Detallada por Día | `planilla_dia` | Total Facturado Día, Tickets, Descuentos, Ticket Promedio |
| | Consolidado Diario | `consolidado_diario` | Facturación Período, Días Auditados, Promedio Diario, Pico de Venta |
| | Medios de Pago & Gaveta | `medios_pago` | Recaudación Efectivo, Tarjetas Bancard/Dinelco, Divisas (BRL/USD), Vales |
| | Rendimiento por Cajera | `cajeras` | Cajeras Activas, Turnos Cumplidos, Tickets Totales, Descuentos Caja |

---

## 3. Especificación del KPI "Monto Pagado a Proveedor"

### 3.1. Requerimiento de Negocio
Varios proveedores entregan mercadería a consignación o cobran en base a la rotación de lo vendido en góndola. Para llevar esa cuenta clara, la administración comercial necesita ver inmediatamente cuánto dinero se le transfirió o pagó a ese proveedor vs. el Costo de la Mercadería Vendida (CMV) de sus productos.

### 3.2. Componente de UI en la Pestaña Proveedores
En el bloque de KPIs de Proveedores se sustituye el KPI redundante de "Unidades" por la tarjeta de **Liquidación & Pagos**:
```
┌──────────────────────────────────────────────────────────────┐
│ MONTO PAGADO AL PROVEEDOR                     [ Este Mes ▾ ] │
│ Gs. 45.000.000                                               │
│ ──────────────────────────────────────────────────────────── │
│ CMV Vendido (Este Mes): Gs. 38.500.000                       │
│ Cobertura: Gs. +6.500.000 (Pagado > Salida de Góndola)       │
└──────────────────────────────────────────────────────────────┘
```
- **Dropdown de Período de Pago**:
  - `Este Mes` (predeterminado): Suma de pagos realizados en el mes calendario en curso.
  - `Total Histórico`: Suma de todos los desembolsos registrados en `supplier_invoice_payments` para ese proveedor.
- **Lógica de Comparación**:
  - `Diferencia = Monto Pagado - CMV Vendido`.
  - Si `Diferencia < 0`: Saldo pendiente a pagar por mercadería ya vendida (color ámbar).
  - Si `Diferencia >= 0`: Pagos al día con relación a la venta (color esmeralda).

### 3.3. Endpoint Backend de Soporte
En `api/src/reports/service.py` y `router.py`:
- `GET /api/reports/sales/by-supplier/payments-summary?supplier_id=UUID`:
  - Retorna `monto_pagado_mes` y `monto_pagado_historico` consultando `SupplierInvoicePayment` vinculados a las facturas del proveedor.

---

## 4. Especificación del Nuevo Módulo: "Compras vs. Ventas" (Open to Buy / OTB)

### 4.1. Concepto y Metodología Retail
El objetivo de este informe es establecer un **techo presupuestario de compras**. En retail de alimentos, si las compras superan cierto umbral de las ventas (ej. más del 70% o 75% del valor de venta, o 100% del costo de reposición), se satura el depósito, se estanca la rotación y se compromete el flujo de caja.

### 4.2. Métricas y Fórmulas
1. **Total Ventas del Período ($V$)**: Facturación bruta neta de devoluciones del POS.
2. **Total Compras del Período ($C$)**: Facturas de compras cargadas en el período (`supplier_invoices` con estado válido).
3. **Ratio Real de Compras sobre Ventas ($R$)**:
   $$R = \left(\frac{C}{V}\right) \times 100$$
4. **Tope Presupuestario de Compra ($T\%$)**:
   - Parámetro interactivo editable por el usuario (ej. 70%, configurable mediante input rápido o presets 65%, 70%, 75%, 80%).
   - **Presupuesto Máximo de Compra ($P_{max}$)**:
     $$P_{max} = V \times \frac{T\%}{100}$$
5. **Saldo Disponible para Comprar (Open to Buy - OTB)**:
   $$\text{OTB} = P_{max} - C$$
   - Si $\text{OTB} > 0$: **🟢 Disponible para comprar**: Margen financiero libre para emitir nuevas órdenes de compra.
   - Si $\text{OTB} \le 0$: **🔴 Presupuesto Excedido (Sobrecompra)**: Se ha comprado más de lo que la venta autoriza para ese porcentaje.

### 4.3. Componentes de la Vista
1. **4 KPIs de Control Financiero**:
   - `Total Ventas`: Ventas en el período seleccionado.
   - `Total Compras Recibidas`: Compras registradas en el período.
   - `Ratio Compras / Ventas`: Con badge dinámico de semáforo (Verde si $\le T\%$, Rojo si $> T\%$).
   - `Cupo Disponible de Compra (OTB)`: Saldo disponible o exceso en Guaraníes.
2. **Barra de Progreso Presupuestario**:
   - Barra visual de 0% a 100% que muestra el consumo del presupuesto de compras asignado.
3. **Gráfico Evolutivo Comparativo**:
   - Línea temporal (día a día o semanal) que compara la curva de Ventas acumuladas vs. Compras acumuladas.
4. **Tabla de Desglose por Proveedor**:
   - Listado comparativo: Proveedor | Ventas Generadas | Compras Recibidas | Ratio C/V | Estado.

### 4.4. Salidas Oficiales
1. **Botón PDF Oficial**: Descarga informe en PDF con formato membretado del Grupo Santa Teresa E.A.S. ("Informe de Control Presupuestario de Compras vs. Ventas").
2. **Botón Excel (.xlsx)**: Planilla estructurada con fórmulas y totales.

---

## 5. Plan de Implementación

1. **Backend (`api/src/reports/`)**:
   - Endpoint `GET /api/reports/purchases-vs-sales`: Agrupa compras y ventas por período y calcula ratios.
   - Endpoint `GET /api/reports/export/purchases-vs-sales.pdf` y `.xlsx`.
   - Soporte para `payments-summary` por proveedor.
2. **Frontend (`ui-web/src/pages/reports/`)**:
   - Refactorizar la barra de navegación de `ReportsPage.tsx` en 3 pestañas maestras con sub-pestañas.
   - Fijar la zona de KPIs para eliminar cualquier salto o parpadeo visual.
   - Integrar el dropdown de `Monto Pagado` en `Ventas por Proveedor`.
   - Crear el componente `ComprasVsVentasTab.tsx` para la nueva pestaña OTB.
3. **Verificación y Pruebas**:
   - Build de Vite (`npm run build`).
   - Verificación con Playwright.
   - Despliegue con `bash deploy-ui.sh` y `bash deploy-api.sh`.
