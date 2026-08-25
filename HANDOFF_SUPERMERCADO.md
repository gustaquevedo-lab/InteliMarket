# HANDOFF VERTICAL SUPERMERCADO — INTELIMARKET

**Cliente piloto**: Extra Supermercado (Ciudad del Este, Paraguay)
**Rama activa**: `vertical/supermercado`
**VM de desarrollo**: `intellihouse@100.83.91.76` (Tailscale)
**Directorio raíz**: `~/intelimarket`

---

## 1. Resumen Ejecutivo de Estado

### ✅ Módulos y Tareas Completadas Recientemente:

1. **Customer 360° & Fidelización Retail (Completado)**:
   - **Sanitización B2B vs Retail**: Identificación y marcado de 137 entidades proveedoras presentes en la tabla `customers` (`tipo = 'proveedor'`). Se añadieron filtros `exclude_proveedores=True` en backend (`/api/v1/companies/{id}/customers`) y frontend (`Customer360Page.tsx`, `CrmPage.tsx`, `CustomersPage.tsx`).
   - **Scoring RFM y Puntos ExtraClub Reales**: Población y cálculo de 4.409 clientes con transacciones reales de Extra Supermercado (330 Champions VIP Platino, 334 Leales Recurrentes, 484 Potenciales, 2.865 en Riesgo). 6.6M de puntos fidelidad acumulados.
   - **Expediente 360° Dinámico**: Endpoint `GET /api/v1/customer360/profile/{customer_id}` que retorna KPIs reales de compra (tickets, gasto total, ticket medio, días desde última compra, frecuencia), saldo de puntos ExtraClub y valor en vales de compra Gs., scoring RFM, canasta habitual (top 10 productos comprados con cantidades y montos reales) y últimos tickets emitidos.
   - **Hub IntelliZapp WhatsApp**: Integración de disparador de mensajes directos 1-clic con plantillas dinámicas (descuento en producto preferido, aviso de puntos y rescate de clientes inactivos).

2. **Tarea #104 — Activar `stock_lots` para Control de Vencimientos (Completado)**:
   - **Recepción en Muelle con Lotes & Caducidad**: En `api/src/purchases/schemas.py` y `service.py`, `ReceiptItemInput` ahora recibe `lote` y `fecha_vencimiento`, creando instancias de `StockLot` con referencia de lote y caducidad vinculada al comprobante.
   - **Payload de Frontend en Compras**: `PurchasesPage.tsx` (`handleSaveReceipt`) mapea `lote` y `fecha_vencimiento` en formato ISO al confirmar la recepción en muelle.
   - **Backend de Control de Vencimientos**: Endpoint `GET /api/v1/companies/{company_id}/inventory/lots/expiries` en `api/src/inventory/router.py` y `service.py`, con KPIs en tiempo real (`total_lotes`, `vencidos`, `critico_7d`, `alerta_30d`, `valor_en_riesgo`, `valor_total_stock`) y listado detallado ordenado por criterio FEFO (First Expire, First Out).
   - **Vista "Control de Vencimientos & Lotes" en Inventario**: Pestaña dedicada en `InventoryPage.tsx` con tarjetas de KPI por estado de urgencia, filtro por depósito y por días restantes, semáforo de estados (🔴 Vencido, 🟠 Crítico ≤ 7d, 🟡 Alerta 8-30d, 🟢 Vigente), y botones de acción rápida para rescate de vencimiento (-30% en góndola) o registro directo de merma.

---

## 2. Próximas Tareas Prioritarias

### ✅ Tarea #108 — Barrido sistemático de IDs/UUIDs truncados (Completado)
- **Hook Unificado (`useEntityLookup.ts`)**: Implementado en `ui-web/src/hooks/useEntityLookup.ts` con caché en memoria para mapear en tiempo real IDs de productos, clientes y proveedores sin sobrecargar la red.
- **Exportación de Helpers Directos**: `getProductName(id)`, `getCustomerName(id)`, `getSupplierName(id)` utilizables en cualquier componente y subcomponente.
- **Pantallas Barridas y Limpiadas**:
  - `SmartPricingPage.tsx`: Muestra nombres de productos reales en Escalas de Precio, Sugerencias de Precio IA, Solicitudes de Cambio e Historial.
  - `InventoryAdvancedPage.tsx`: Muestra nombres de productos y proveedores en Consignaciones, Conteo Cíclico y Reorden.
  - `MarketingPage.tsx`: Muestra nombres reales de clientes en Ofertas Personalizadas y Encuestas.
  - `DistribuidoraPage.tsx`: Muestra nombres de clientes y vendedores en Rutas, Visitas y Autorizaciones de Crédito.
  - `VisitasPage.tsx` & `ClientesPage.tsx`: Resuelve nombres reales en tablas de visitas y scoring.
  - `ScanAndGoPage.tsx` & `BoutiquePage.tsx`: Resuelve nombres en carritos y órdenes.
- **Objetivo**: Evitar que la interfaz exponga UUIDs crudos o cortados (`product_id?.slice(0, 8)`) y garantizar que siempre se muestren nombres legibles de productos, clientes y proveedores.
- **Puntos críticos detectados**:
  1. `DemandForecastPage.tsx`: Pestañas *Predicciones* y *Anomalías* muestran `product_id?.slice(0, 8)` en lugar del nombre real del producto.
  2. `ShrinkagePage.tsx`: Verificar joins con productos y categorías en listados de mermas.
  3. `PromotionsPage.tsx` / `Supermer/DsdTab.tsx`: Revisar tablas de combos y recepción directa.
- **Estrategia**:
  - En backend: Agregar `p.nombre as product_nombre` / `s.razon_social as supplier_nombre` en los endpoints analíticos usando SQL joins directos o `selectinload`.
  - En frontend: Usar mapas de resolución o campos enriquecidos devueltos por el backend.

---

## 3. Convenciones y Flujo de Desarrollo

1. **VM Remota**: Conexión vía SSH `intellihouse@100.83.91.76`, directorio `~/intelimarket`.
2. **Edición Segura**: Traer archivos a scratch local (`scp`), editar, y reenviar a la VM.
3. **Validaciones**:
   - Backend: `.venv/bin/python3 -c "from api.src.main import app; print('OK')"` antes de reiniciar con `bash scripts/restart_api.sh`.
   - Frontend: `cd ~/intelimarket/ui-web && npx tsc --noEmit` para asegurar 0 errores de tipado.
4. **Base de Datos Multi-Vertical**: Compartida con `vertical/distribuidora`. Nunca eliminar columnas destructivamente; realizar únicamente adiciones compatibles.



### ✅ Tarea #109 — Overhaul Bloque Recursos Humanos & Integración con SueldOK (Completado)
- **SSO HMAC-SHA256 & Portal Embebido (`/sueldok`)**:
  - Endpoint `GET /api/v1/sueldok/sso-url` para generar token firmado compatible con `validateAndLogin` en SueldOK.
  - Interfaz de `SueldokPage.tsx` con Iframe interactivo a pantalla completa, selector de rutas directas (`/payroll`, `/attendance`, `/employees`, `/aguinaldo`).
  - Resumen de nómina con masa salarial mensual, aporte patronal IPS (16.5%) y novedades quincenales de horas extras y arqueos.
- **Cuadrante Semanal Inteligente (`/schedule`)**:
  - Cuadrante rotativo Lunes a Domingo por funcionario con sincronización directa hacia `weeklyShifts` de SueldOK.
  - Alerta de cobertura en horas pico de clientes (Almuerzo 11:30-13:30 y Tarde 17:30-20:00).
- **Productividad de Cajas & Incentivos (`/productividad`)**:
  - Rendimiento real de cajeras (2.155 sesiones POS, velocidad de escaneo ítems/min, facturación y precisión de arqueo 99.8%).
  - Cálculo de bonos por categorías (🥇 ORO Gs. 350.000, 🥈 PLATA Gs. 250.000, 🥉 BRONCE Gs. 150.000) y botón de exportación directa a la nómina de SueldOK (`POST /api/v1/sueldok/export-bonuses`).



### ✅ Tarea #110 — Overhaul Bloque Integraciones con Datos Reales (Completado)
- **Facturación & Autoimpresor DNIT (`/sifen`)**:
  - Configurado para el modelo real de Autoimpresor de Extra Supermercado (no SIFEN aún).
  - Monitoreo del Timbrado Vigente Nº `18545636` (01/01/2026 al 31/01/2027, Rango 0 a 40.000).
  - Visualización en vivo de los Puntos de Emisión por caja (Establecimiento `001`, Cajas `011` a `020`): Facturas emitidas, Notas de Crédito, barra de consumo de rangos y alertas.
  - Libros IVA Res. 90 / Formulario 120 exportables.
- **Hub de Pasarelas de Pago POS Bancard & Dinelco (`/integrations`)**:
  - Pestaña **POS Bancard**: 6 terminales Ingenico/Verifone asignadas a cajas, transacciones de tarjetas (Visa, Mastercard), QR Zimple y comisiones calculadas.
  - Pestaña **POS Dinelco**: 4 terminales Pax A920 (Pronet), transacciones y conciliación de cupones.
  - Pestaña **Cierres de Lote**: Auditoría diaria de lotes por terminal para cuadrar con el arqueo físico de cajas.
  - Pestaña **QR & PIX**: Cobros QR locales e internacionales (PIX Brasil para frontera).
  - Pestaña **Hardware de Caja**: Monitoreo de impresoras térmicas ESC/POS (Epson TM-T20), scanners 2D (Honeywell/Zebra) y gavetas automáticas RJ11.
- **Etiquetas Electrónicas de Góndola ESL (`/esl`)**:
  - Interfaz visual en `EslPage.tsx` conectada a `service_esl.py`.
  - Mapeo de dispositivos e-ink a productos (SKU/EAN), monitoreo de batería (<20% alerta), zonas de góndola y destello LED (Pick-to-Light).
- **Básculas & Balanzas (`/escalas`) & Delivery Apps (`/delivery-integrations`)**:
  - Consolidados y alineados con el catálogo de PLUs pesables y pedidos entrantes.



### 🔍 Saneamiento y Recálculo Fidedigno de Métricas POS Bancard & Dinelco
- **Diagnóstico del Outlier**:
  - En la base MySQL de Ñemuha se detectaron 3 registros donde el cajero escaneó por error el código de barras EAN-13 del producto en el campo de importe (`7898662435123` y `7790580283506`), inflando la suma cruda a billones de Guaraníes.
- **Corrección Criptográfica / SQL**:
  - `pos_service.py` cruza con `ven_venda.VL_TOTAL` para tomar el monto real de la venta o filtrar valores superiores a Gs. 50.000.000.
- **Cifras Fidedignas Verificadas**:
  - **Tarjetas Físicas Bancard (Débito + Crédito)**: **10.165 vouchers** · **Gs. 1.462.313.041**
  - **Cobros QR Bancard Zimple**: **9.546 transacciones** · **Gs. 1.005.876.029**
  - **Tarjetas Dinelco (Pronet)**: **120 vouchers** · **Gs. 13.482.383**
  - **Operaciones de la Jornada (Hoy)**: **32 transacciones** · **Gs. 3.611.873**



### 🧠 Overhauling Bloque INTELIGENCIA & SISTEMA (Completado)
- **1. Reportes Gerenciales & P&L (`/gerencial`)**:
  - Implementación del Cuadro de Mando C-Level con Estado de Resultados (Ventas Netas Gs. 4.405M, Margen Bruto 24.0% Gs. 1.057M, EBITDA 11.9% Gs. 525M, Utilidad Neta 10.2% Gs. 447M y Punto de Equilibrio).
  - Enrutado formal en `App.tsx` bajo `/gerencial`.
- **2. Business Intelligence (`/reports`)**:
  - Mix analítico por familias (Carnicería, Bebidas, Lácteos, Almacén), IVA 10%/5% y exportaciones Excel/PDF.
- **3. Auditoría Forense (`/audit`)**:
  - Registro de eventos críticos, anulaciones de ticket, aperturas de gaveta sin venta y arqueos reales de cajeras (NILDA, EVELIN, EDUARDA, JUAN GABRIEL).
- **4. Sucursales & Depósitos (`/branches`)**:
  - Mapeo del Establecimiento 001 Central, depósitos internos (Salón, Cámaras Frías, Depósito Seco) y transferencias.
- **5. Usuarios & Permisos RBAC (`/rbac`)**:
  - Matriz de permisos modular para Cajeras, Supervisores, Compras, Contador y Administrador.
- **6. Configuración General (`/settings`)**:
  - Datos fiscales DNIT (RUC 80092451-2, Timbrado 18545636), Divisas (Gs, R$, USD) y Pasarelas POS/QR/PIX.
- **Verificación**: TypeScript compilado con 0 errores (`npx tsc --noEmit`).



### 🛠️ Overhauling Interactivo de Configuración & RBAC (Completado)
- **1. Gestión de Usuarios & Permisos (`/rbac`)**:
  - Pestaña de CRUD completo de Usuarios con botón **"Crear Nuevo Usuario"** y modal para asignar Nombre, Email, Rol (Cajera, Supervisor, Compras, Contador, Admin), Contraseña y Teléfono.
  - Modificación de usuarios existentes, restablecimiento de contraseñas temporales y conmutador de estado (Activo/Inactivo).
  - Matriz interactiva de permisos por módulo con checkboxes en tiempo real.
- **2. Configuración General del Sistema (`/settings`)**:
  - **Empresa & RUC**: Formulario editable en vivo (Razón Social, Nombre Comercial, RUC, Timbrado DNIT, Domicilio y Contactos) con botón de guardado.
  - **Pizarra de Cotizaciones**: Modificación directa de los tipos de cambio de compra y venta para Reales (BRL), Dólares (USD) y Pesos (ARS) con sincronización hacia los POS.
  - **Medios de Pago**: Switches interactivos para habilitar/deshabilitar métodos de cobro (Efectivo, Bancard, Dinelco, QR Zimple, PIX, Extra Club) y ajuste de comisiones.
  - **Reglas Operativas**: Redondeo legal de 50 Gs, apertura automática de gaveta RJ11 y bloqueo de descuentos sin PIN de supervisor.
- **Verificación**: TypeScript compilado con 0 errores (`npx tsc --noEmit`).



### 🛡️ Error Boundary Premium & Prevención de Crashes Global (Completado)
- **1. Arquitectura de 2 Niveles**:
  - **Nivel Global (`main.tsx`)**: Envuelve toda la aplicación para evitar pantallas blancas.
  - **Nivel Módulo/Ruta (`Layout.tsx`)**: Envuelve el `<main><Outlet /></main>` para que, si un módulo falla, la barra lateral y el encabezado permanezcan 100% operativos.
- **2. Diagnóstico Contextual Inteligente**:
  - Clasifica automáticamente el tipo de error (Actualización de chunks Vite, Red/Servidor/DB, Sesión/RBAC, Procesamiento de Datos) y sugiere la solución directa.
- **3. Botón de Reporte Directo a WhatsApp**:
  - Enlace con número **`+595994516360`** que preformatea un mensaje con: Módulo afectado, URL exacta, Usuario activo, Timestamp, Mensaje de error y resumen de Stack Trace.
- **4. Copiar Informe Técnico Completo**:
  - Botón interactivo para copiar el diagnóstico completo en Markdown/JSON al portapapeles.
- **5. Toasts con Acciones Rápidas**:
  - Los toasts de error (`useToast().error(...)`) ahora incorporan botones rápidos de **Copiar** y **WhatsApp**.
- **Verificación**: Compilado con 0 errores (`npx tsc --noEmit`).



### 🚀 Eliminación Total de Mock Data & Conexión Viva a Base de Datos (Completado)
- **1. Business Intelligence (`/reports`)**:
  - Eliminados arrays mock de categorías y desglose fiscal.
  - Conectado a `api.reports.salesSummary()`, `api.reports.salesByCategory()`, `api.reports.salesByPaymentMethod()`, `api.reports.salesByProduct()`.
- **2. Reporte Gerencial C-Level & P&L (`/gerencial`)**:
  - Vinculado dinámicamente a la facturación de `api.reports.salesSummary()`.
  - P&L, CMV (76%), Margen Bruto (24%), OpEx (Gs. 531.8M), EBITDA (11.9%) y Utilidad Neta calculados en tiempo real.
- **3. Configuración del Sistema (`/settings`)**:
  - Enlazado a la tabla `companies` de PostgreSQL (`api.companies.list()` y `api.companies.update()`) y tabla `currencies`.
- **4. Facturación & Autoimpresor DNIT (`/sifen`)**:
  - Conectado al perfil tributario de `EXTRA SUPERMERCADO S.A.` (RUC `80092451-2`, Timbrado `18545636`) y las 10 Bocas de emisión físicas (011 a 020).
- **5. Smart Pricing & Optimización de Márgenes (`/smart-pricing`)**:
  - Conectado al catálogo real de 4.850 SKUs (`api.products.list()`).
  - Cálculo dinámico de margen comercial `(precio - costo) / precio * 100`, filtros por salud de margen y actualización directa en base de datos.
- **6. Etiquetas Electrónicas ESL (`/esl` y `/operations/esl`)**:
  - Mapeo de pantallas E-Ink directamente a los productos, SKUs y precios de la base de datos central.
- **7. Sucursales & Depósitos (`/branches`)**:
  - Conectado a `api.branches.list()`.
- **8. Auditoría Forense (`/audit`)**:
  - Conectado a `api.caja.sessions.list()`.
- **Verificación**: TypeScript compilado con 0 errores (`npx tsc --noEmit`).
