# HANDOFF VERTICAL SUPERMERCADO — INTELIMARKET

**Cliente piloto**: Extra Supermercado (Pedro Juan Caballero, Paraguay — Grupo Santa Teresa E.A.S.)
**Rama activa**: `vertical/supermercado`
**VM de desarrollo real**: `intellihouse@192.168.0.242` (o Tailscale `100.83.91.76`) — **el IP viejo de la sección de abajo (100.83.91.76 como único acceso) está desactualizado, usar 192.168.0.242 directo**
**Directorio raíz**: `/home/intellihouse/intelimarket`
**Sandbox**: API `:8001` / UI `:5174` (schema `sandbox`) — arrancar con `/home/intellihouse/intelimarket/start-sandbox.sh`
**Producción**: API `:8000` / UI `:5173` (schema `public`) — systemd `intelimarket-api.service` / `intelimarket-ui.service`

---

## 🚨 SESIÓN 2026-08-25 (NOCHE) — CRÍTICO, LEER PRIMERO ANTES DE ABRIR NADA

Esta es la sección más reciente. Reemplaza en prioridad a la de abajo (misma fecha, sesión distinta — la de abajo fue de tarde/Verificador de Precios, esta fue de noche/POS-Facturación). Se tocó **el corazón del sistema: checkout, caja, facturación** — leer completo antes de tocar `POSPage.tsx`, `CajaRapidaPage.tsx`, `sales/`, `caja/`.

### Qué pasó esta noche (para que no se repita)

**1) Otra sesión concurrente corrompió `App.tsx` en vivo.** A mitad de esta sesión se encontró `ui-web/src/App.tsx` con 3 líneas cambiadas sin commitear (import de `Dashboard` repuntado a `DashboardDistribuidora`, ruta `/supervisor` eliminada) — nadie de esta sesión las tocó. Causó que `/supervisor` mostrara un login genérico sin lista de supervisoras. Se revirtió a lo último commiteado. **Causa raíz: dos sesiones (Distribuidora y Supermercado) escriben sobre el mismo working directory de la VM sin ningún lock — la separación por rama de git NO protege contra esto, porque las ediciones directas a disco pisan lo que sea que esté ahí, commiteado o no.**

**2) El checkout local de la Mac de control estaba gravemente desincronizado — casi arruina una auditoría.** Al pedir una auditoría de correctitud del POS, corrió (por defecto) contra el checkout local de la sesión de Claude, que estaba en un commit viejísimo (`ebdcc09 WIP: snapshot antes de separar por vertical`, 389 archivos de diferencia con la rama real). Salieron hallazgos "gravísimos" que en realidad eran de código **ya corregido** en la VM (falta `company_id` en el checkout, `session_id` nunca se guarda, caja nunca llama al backend). Se verificó cada hallazgo contra el código real de la VM antes de actuar — varios eran falsos positivos por el desfase, pero **9 eran reales** y se corrigieron (ver commits `dcfa39d` y `bfddece`).

> **Regla dura de acá en adelante: la VM (`192.168.0.242` / Tailscale `100.83.91.76`) es la ÚNICA fuente de verdad para código de Supermercado. Cualquier herramienta, auditoría o revisión que corra sobre un checkout local primero tiene que sincronizarse contra `origin/vertical/supermercado` (o mejor, correr directo contra la VM por SSH) — nunca asumir que el local está al día.**

**3) 51 commits llevaban semanas sin pushearse a GitHub.** Todo el trabajo de varias sesiones (incluyendo el Verificador de Precios completo, las terminales Digiware, y todo lo de esta noche) vivía **solo en el disco local de la VM**, nunca en `origin/vertical/supermercado`. Si ese disco se pierde o alguien hace algo destructivo ahí, se pierde todo sin repuesto. **Ya se pusheó** (`git push origin vertical/supermercado`, ahora sincronizado hasta `bfddece`).

**4) Un `DELETE` de limpieza de datos de prueba, filtrado solo por monto, borró una fila real de `sandbox.cash_register_movements`** (coincidía por casualidad con el mismo monto que la prueba). Se detectó enseguida, se confirmó que `public` (producción real) nunca se tocó, y se restauró la fila copiándola desde `public` (que resultó ser casi un espejo de `sandbox`). **Lección aplicada: limpiar datos de prueba siempre por ID exacto o por ventana de tiempo acotada a la sesión actual, nunca por un campo de valor (monto, nombre) que puede coincidir con datos reales.**

### Protocolo obligatorio de acá en adelante (cualquier sesión, cualquier IA)

1. **Antes de tocar cualquier archivo compartido** (`App.tsx`, `POSPage.tsx`/`CajaRapidaPage.tsx`, `sales/`, `caja/`, `customers/`, `Dashboard*.tsx`): correr `git status --short` y `git log --oneline -5 -- <archivo>` en la VM primero. Si hay cambios sin commitear que no son propios, **no pisarlos** — investigar antes de tocar (puede ser la otra sesión trabajando en vivo).
2. **Commitear cada fix apenas se verifica**, nunca acumular (regla ya existente, ver sección de abajo — se volvió a incumplir esta noche con los 51 commits sin pushear, ahora doblemente reforzada).
3. **Pushear a `origin` con frecuencia**, no solo commitear local. Un commit sin pushear en la VM tiene la misma fragilidad que no commitear en absoluto si el disco de la VM falla.
4. **Nunca correr una auditoría, code-review o herramienta de análisis contra un checkout que no se verificó estar sincronizado con la VM.** Si hay dudas, `git fetch origin vertical/supermercado && git log HEAD..origin/vertical/supermercado --oneline` para ver qué tan atrás está el local.
5. **Limpieza de datos de prueba: siempre por ID exacto**, nunca por monto/nombre/fecha aproximada — aunque parezca "obviamente" un dato de prueba, puede coincidir con un dato real por casualidad.

### Qué se hizo esta noche (POS / Facturación / Caja) — commits en orden

- `d3fea65` — stock real en Consulta de Productos (bug de URL `/inventory/` de más) + tamaño de letra de escalas/monedas.
- `732ee5c` — cierre de caja multimoneda, desglose por forma de pago, bug de efectivo esperado (contaba TODAS las formas de pago, no solo efectivo).
- `7c626b9` — búsqueda/alta de cliente y urgencia en el modal de Producto No Encontrado.
- `02b4343` — aviso de puntos de fidelidad ganados (toast + ticket), tag Extra Club en búsquedas, función "Reabrir Factura" (agregar identificación a una venta que salió Consumidor Final, con autorización de supervisor).
- `78343c5` — **rediseño completo del modal de Liquidación y Cobro**: de 6 pestañas excluyentes (con "Pago Mixto" duplicando cada campo) a botones que se prenden/apagan por método, mostrando todas las líneas activas a la vez. Preserva el ciclo de teclado Gs→R$→US$→Gs, los campos reales de Bancard/Dinelco, y la regla de cliente de Extra Club.
- `c6472df` — **bug fiscal grave**: el IVA se sumaba ENCIMA del precio de venta en vez de extraerse de un precio que ya lo incluye — el total grabado en cada venta/presupuesto/pedido quedaba ~9-10% inflado sobre lo realmente cobrado. Mismo bug copiado en `quotes/` y `sales_orders/`. **Cero ventas de producción afectadas** (producción todavía corre sobre datos legado, no sobre este flujo).
- `dcfa39d` — auditoría línea por línea del checkout/caja/ventas: `cancel_sale` no revertía crédito/CxC/puntos (solo stock), `add_payment` estaba roto de raíz (import faltante), fuga de datos entre empresas en `list_sessions`, reporte de arqueo duplicaba el fondo de apertura, bug de cantidad en productos pesables (báscula), atajos de teclado activos con el modal de cobro abierto, `NaN` se colaba en el chequeo de "falta cobrar".
- `bfddece` — WhatsApp real (columna con tipo de dato que nunca existió en la base), bloqueo de concurrencia en 4 puntos de caja/bóveda, función de anulación de un retiro de efectivo ya confirmado.

Todo verificado contra datos reales en sandbox (ventas de prueba creadas y limpiadas por ID), no solo leído. Ver el chat de esta sesión para el detalle línea por línea de cada fix si hace falta reconstruir el razonamiento.

---

## ⚠️ SESIÓN 2026-08-25 — LEER ANTES DE TOCAR NADA

Esta sección es la más reciente y prioritaria. Hubo **dos sesiones trabajando en paralelo** sobre esta misma rama (una en Supervisor PWA / Verificador de Precios / Caja — este handoff — y otra en POS/Extra Club/Customers/Dashboard, ver commits `83514b1`, `8819995`, `5cfd2fd`, `ae114b3`, `d3fea65` y los que sigan). **Antes de tocar `ui-web/src/pages/pos/POSPage.tsx`, `CajaRapidaPage.tsx`, `Dashboard.tsx`, `customers/`, `sales/` revisar `git log` reciente de esos archivos — puede haber trabajo de esa otra sesión en curso.**

### 1. Verificador de Precios de salón (`/verificador`) — overhaul completo

Antes: mostraba precios/productos **inventados** si la API fallaba, buscaba por texto aproximado en vez de código exacto, y los descuentos "mayorista/pack/club" eran multiplicadores fijos sin ningún dato real detrás. Todo esto se reemplazó por datos reales:

- **Backend nuevo**: `api/src/kiosk/` (models/schemas/service/router). Endpoints públicos (sin login, para terminales de salón):
  - `GET /v1/kiosk/lookup?code=&company_id=` — match EXACTO por código de barra/SKU contra `products`. 404 real si no existe, nunca inventa nada. Incluye la escala de precios real del producto desde `sp_tiered_prices` (tabla ya existente, sincronizada de Ñemuha, **estaba completamente sin usar** en todo el sistema — 7.585 productos con escalas reales).
  - `GET /v1/kiosk/banners/active?company_id=` — banners activos para las terminales.
  - CRUD de banners con sesión (`POST/GET/PATCH/DELETE /v1/kiosk/banners`, `POST /v1/kiosk/banners/{id}/image` con resize a 1600px) — gestionado desde el frontend en **Gerente de Marketing IA → pestaña "Verificador de Precios"** (`MarketingAgentPage.tsx`).
  - Tabla `kiosk_banners` creada en ambos schemas (`sandbox` y `public`) + migración Alembic `20260825110000_add_kiosk_banners.py`.
- **Frontend**: `ui-web/src/pages/kiosk/PriceCheckerKioskPage.tsx` reescrita:
  - Nunca fallback inventado — si falla la conexión muestra "Sin Conexión", nunca un precio falso.
  - Modo claro/oscuro real vía `ThemeContext`, pero con **toggle de 2 estados propio** (no el `toggle()` compartido de 3 estados claro→oscuro→sistema — en un kiosco fijo eso causaba que un toque de más en la pantalla táctil cayera en "sistema" y pareciera que el modo oscuro "no persistía").
  - Layout de 2 columnas (identidad+escaneo | banner+cotizaciones), `items-stretch` + `justify-between` para llenar el alto real sin dejar hueco vacío abajo.
  - **La resolución real de las 3 terminales Digiware es 1024×768 (4:3), NO 1366×768** — verificado con `[System.Windows.Forms.Screen]::AllScreens` en la máquina física. Cualquier ajuste visual futuro debe probarse a 1024×768 exacto, no asumir 1366px.
  - Logo real de la empresa (Configuración), no un logo inventado.
  - Precios de escala grandes (accesibilidad) con conversión a R$/US$ en cada escalón.
- **Toggle de monedas activas por tenant**: `Configuración → Pizarra de Cotizaciones` tiene un switch por moneda (PYG bloqueado siempre activo, BRL/USD/ARS togglables), persistido en `company.config.currencies.{codigo}.activo`. **ARS ya está desactivado** para Extra Supermercado (no se usa en esta frontera). Si una moneda está inactiva no debe aparecer en ningún lado — el Verificador ya respeta esto, revisar si se agrega este toggle a otras pantallas que muestren multimoneda (POS, Caja).
- **Auto-recarga de madrugada** (4am, solo si la pantalla está en reposo) para que las terminales absorban cambios de código sin que nadie las reinicie a mano.

Commits clave (en orden): `f9e6761`, `500b07a`, `2e9f4c3`, `1a39003`, `d0435e2`, `118373a`, `c33bfb9`, `3472a0b`, `fff91dc`, `185ce37`, `fb3a63c`, `31704de`, `9d9d48e`.

### 2. Terminales físicas Digiware (Windows, táctiles, sin teclado/mouse) — acceso remoto

Se configuró acceso remoto por **WinRM + NTLM** (no SSH) para instalar/actualizar el kiosco sin depender de que alguien toque físicamente la pantalla. Requiere que la máquina ya tenga WinRM habilitado (`Enable-PSRemoting -Force` + `winrm quickconfig -quiet` corrido una vez localmente con el teclado táctil — bootstrap ya hecho en las 2 primeras).

**Herramienta**: `pywinrm` instalado en un venv en el VM: `/tmp/winrm_env/bin/python3` (¡ese venv está en `/tmp`, no persiste si se reinicia el VM — si desaparece, `python3 -m venv /tmp/winrm_env && /tmp/winrm_env/bin/pip install pywinrm`). Helper genérico: `/tmp/run_winrm.py <ip> <user> <password> <script.ps1>`.

**⚠️ GOTCHA CRÍTICO — Sesión 0 vs Sesión 1**: cualquier `Start-Process` lanzado directo desde una sesión WinRM cae en la **Sesión 0** de Windows (invisible, sin pantalla) — el proceso existe y `Get-Process` lo muestra, pero **nunca aparece en el monitor físico**. Para que una app GUI se vea en la pantalla real hay que pedirle a la tarea programada que la lance ella misma:
```powershell
Start-ScheduledTask -TaskName KioskWatchdog
```
nunca `Start-Process` directo por WinRM para relanzar. Verificar con `Get-Process msedge | Select SessionId` — tiene que decir `1` (sesión de consola), no `0`.

**Estado de las 3 terminales**:
| # | IP | Usuario | Hostname | Estado |
|---|----|---------|----------|--------|
| 1 | `192.168.0.234` | `pc` | `CONSULTOR3` | ✅ Configurada y verificada (Windows 11 Pro) |
| 2 | `192.168.0.247` | `user` | `CONSULTOR1` | ✅ Configurada y verificada (Windows 10 Pro) |
| 3 | — | — | — | ❌ **Pendiente — problema de hardware en el lector de código de barras, no configurar hasta que lo resuelvan físicamente** |

Contraseña de administrador local en ambas: `Extra2026` (la cuenta no tenía contraseña — WinRM/NTLM rechaza cuentas sin clave para acceso remoto por seguridad, así que se le puso una. **Ojo**: es una contraseña real de administrador expuesta por red, considerar rotarla si se hace mantenimiento serio de seguridad más adelante).

En cada máquina configurada quedó:
- Registro `Winlogon` con auto-login reparado (`AutoAdminLogon=1`, `DefaultUserName`, `DefaultDomainName`, `DefaultPassword`) — **estaba vacío antes de tocarlo, un riesgo real de dejar la pantalla trabada pidiendo clave sin teclado para escribirla**.
- `C:\ProgramData\kiosk\launch.bat` — lanza Edge en modo kiosco: `--kiosk "http://192.168.0.242:5174/verificador" --edge-kiosk-type=fullscreen --no-first-run --noerrdialogs --disable-translate --overscroll-history-navigation=0`.
- Acceso directo en `Startup` del usuario (arranca solo al prender la máquina, sí queda en Sesión 1 correctamente porque corre al login real).
- `powercfg` sin apagado de pantalla ni suspensión.
- Tarea programada `KioskWatchdog` — cada 5 min, revisa si `msedge` está corriendo y si no lo relanza (`Principal -LogonType Interactive -UserId <hostname>\<user>` — así sí se adjunta a Sesión 1 al dispararse sola desde el Programador de Tareas, a diferencia de cuando yo la invoco a mano por WinRM).

**Apunta a sandbox (`192.168.0.242:5174`), no a producción** — decisión explícita del usuario, pendiente de coordinar con la otra sesión antes de mover a `5173`.

### 3. Supervisor PWA (`/supervisor`) — bugs recurrentes resueltos

- `ui-web/src/api/index.ts` volvió a tener rutas/paths rotos **3 veces distintas** en la misma sesión (`start-pos-shift` vs `pos-shift/start`, `company_id` faltante en query params) — cada vez porque el archivo tenía cambios sin commitear que se perdían. **Si algo de `supervisorRequests`, `startPosShift`/`activeSupervisor`/`endPosShift`, o `posSupervisors` deja de andar, sospechar primero de este archivo antes que de lógica nueva.**
- Redirect a `/login` general en vez de recargar la página actual cuando expira la sesión — corregido en `request()` de `api/index.ts` (ahora hace `window.location.reload()` en vez de navegar a una ruta fija).
- Picker de supervisoras (no admins) en el login de la PWA, igual que el picker de cajeros de Electron — endpoint público nuevo `GET /v1/auth/pos-supervisors` (solo rol `supervisor`, sin admin).
- Commits: `50c3fd7`, `b917e70`, `8061cb6`, `d485889`.

### 4. Regla nueva y firme: commitear apenas se verifica un fix

267 archivos llevaban sin commitear un tiempo largo cuando arrancó esta sesión — causa directa de que el bug de rutas de `api/index.ts` volviera 3 veces (cualquier copia vieja pisando el archivo lo hacía desaparecer sin aviso). **Commitear cada fix apenas se verifica, no acumular.** Ver `.gitignore` actualizado (excluye `dist-electron/`, `downloads/`, `*.zip` de Electron, `uploads/`, `api/static/`, `.env.*`) — revisar `git status --short` antes de cada commit igual, por si aparece algo nuevo sin cubrir.

---

## 1. Resumen Ejecutivo de Estado (secciones anteriores, pre-2026-08-25)

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

1. **VM Remota**: Conexión vía SSH `intellihouse@192.168.0.242` (Tailscale `100.83.91.76` como alternativa), directorio `/home/intellihouse/intelimarket`.
2. **Edición Segura**: Traer archivos a scratch local (`scp`), editar, y reenviar a la VM.
3. **Validaciones**:
   - Backend: `.venv/bin/python3 -c "from api.src.main import app; print('OK')"` antes de reiniciar.
   - Frontend: `cd ui-web && npx tsc -b --force` para asegurar 0 errores de tipado.
4. **Base de Datos Multi-Vertical**: Compartida con `vertical/distribuidora`. Nunca eliminar columnas destructivamente; realizar únicamente adiciones compatibles.
5. **Commitear apenas se verifica un fix** (ver sección de arriba) — no acumular cambios sin commitear.

(resto del historial de tareas completadas sin cambios, ver debajo)

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
  - **Pizarra de Cotizaciones**: Modificación directa de los tipos de cambio de compra y venta para Reales (BRL), Dólares (USD) y Pesos (ARS) con sincronización hacia los POS, **ahora con switch de activo/inactivo por moneda (ver sección 2026-08-25)**.
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
