# Handoff para Antigravity — InteliMarket, vertical Distribución (Casa Gonzalito)

**Escrito por:** Claude (Anthropic), sesión del 2026-08-11 al 2026-08-14.
**Motivo:** el dueño (Gustavo) se quedó sin límite semanal de uso en Claude Code (vuelve el lunes) y necesita que otro asistente (Antigravity) continúe este mismo trabajo mientras tanto, en la misma rama, sin perder contexto ni romper nada.

**Leé este documento completo antes de tocar código.** Hay reglas no negociables abajo (sección "Reglas estrictas") que si no se respetan pueden romper un sistema en producción con datos reales de un cliente real, o pisar el trabajo de otra sesión de IA que está corriendo en paralelo en otra rama.

---

## 1. Qué es esto

**InteliMarket** es un ERP multi-tenant para Paraguay (ventas, compras, inventario, finanzas, CRM, etc.), con distintas "verticales" (paquetes de features) para distintos tipos de negocio: Retail, Distribución/Mayorista, Supermercado, Farmacia, Boutique, Servicios.

**El cliente real y único con datos reales de producción es "Casa Gonzalito"**, un distribuidor mayorista de bebidas y abarrotes en Paraguay (vertical **Distribución**). Todo lo que se construye en esta rama es para él. No es un demo — tiene 121 vendedores reales, ~2 millones de ventas históricas migradas del sistema legacy, y opera todos los días.

El repo también tiene una vertical **Supermercado** con OTRO cliente real, que se desarrolla en **otra rama, en otra sesión de IA, en paralelo, ahora mismo**. Ver sección 3.

### Infraestructura física

Todo corre en una máquina física en la casa/oficina del dueño: un **Minisforum** (mini-PC) con hostname Tailscale `minisforum-ia`. Esa máquina tiene:
- PostgreSQL (base real, `intelimarket`, usuario `intelimarket`)
- El backend FastAPI (`api/src/main.py`, puerto 8000)
- El frontend Vite/React (`ui-web/`, puerto 5173)
- Un gateway angosto para la app móvil Inteliforce (puerto 8081, solo esa ruta expuesta a internet vía Cloudflare Tunnel)
- MariaDB (legado, de una migración anterior, no se usa activamente)
- Tailscale (red privada) conectando esta máquina, la Mac del dueño, su iPhone, y otros nodos

---

## 2. Cómo conectarte al Minisforum

Si esta sesión de Antigravity corre en la **misma Mac** que usó Claude (la del dueño), el acceso SSH ya debería estar configurado (`~/.ssh/config` tiene un host `minisforum-ia` apuntando por Tailscale, con clave ya autorizada). Probá:

```bash
ssh minisforum-ia "echo ok"
```

Si eso responde `ok`, ya tenés acceso. Si no, pedile al dueño que confirme que esta sesión tiene acceso a la red Tailscale y a esa clave SSH — no inventes ni pidas credenciales nuevas, avisale a él.

### El repo NO está clonado localmente en tu entorno (probablemente)

El checkout de git que usó Claude en esta Mac es **sparse** (solo tiene `client-app/`, `docs/`, `driver-app/`, `mobile/`, `scripts/`, `seller-app/` — NO tiene `api/` ni `ui-web/`). El código real de `api/` y `ui-web/` vive completo en el Minisforum, en:

```
/home/intellihouse/intelimarket
```

**Patrón de trabajo usado toda esta sesión** (replicalo, funciona bien):
1. Para LEER un archivo: `ssh minisforum-ia "git -C /home/intellihouse/intelimarket show vertical/distribuidora:api/src/algo.py"` o directamente `ssh minisforum-ia "cat /home/intellihouse/intelimarket/api/src/algo.py"` (el segundo te da el estado actual del working tree, no solo lo commiteado — preferilo si estás iterando).
2. Para EDITAR: escribí el archivo completo localmente (en tu propio scratch/tmp), y subilo con `scp archivo.py minisforum-ia:/home/intellihouse/intelimarket/api/src/algo.py`. Para cambios chicos también sirve `ssh minisforum-ia "sed -i '...' /home/intellihouse/intelimarket/ruta"` pero es más frágil — para bloques de código multilínea es mucho más seguro escribir el archivo completo y mandarlo por scp.
3. El backend corre con `--reload` (uvicorn detecta cambios solo). El frontend corre con Vite (`npm run dev`, también HMR automático). **Después de cada cambio, esperá ~3-4 segundos y revisá el log** (ver sección 4) antes de asumir que compiló bien — varias veces esta sesión un cambio rompió la compilación silenciosamente y solo se detectaba mirando el log o pegándole un curl directo al módulo.

### Base de datos

Postgres corre en el propio Minisforum, accesible por TCP local:

```bash
ssh minisforum-ia "PGPASSWORD=intelimarket_dev psql -h localhost -U intelimarket -d intelimarket -c 'SELECT 1'"
```

(Usuario/password/DB visibles también en `docker-compose.yml` del repo — son credenciales de entorno dev, no producción-pública, pero tratalas igual con cuidado.) La conexión por socket local (`psql` sin `-h`) falla por peer auth — siempre usá `-h localhost`.

`company_id` de Casa Gonzalito (usalo en TODAS las queries/tokens): `00000000-0000-0000-0000-000000000010`

### Cómo autenticarte contra la API para probar endpoints

No hay un usuario/password de prueba a mano fácil. El patrón usado toda la sesión: mintear un JWT directamente con la misma función que usa el backend:

```bash
ssh minisforum-ia "cd /home/intellihouse/intelimarket && source .venv/bin/activate && python -c \"
from api.src.auth.jwt import create_access_token
from datetime import timedelta
tok = create_access_token({'sub':'11111111-1111-1111-1111-111111111111','company_id':'00000000-0000-0000-0000-000000000010','tenant_id':'00000000-0000-0000-0000-000000000001','rol':'admin'}, expires_delta=timedelta(hours=6))
print(tok)
\""
```

Guardá el token y usalo como `Authorization: Bearer $TOK` en tus pruebas con curl. Ojo: expira, si ves `"Invalid token: Signature has expired"` mintea uno nuevo.

---

## 3. Reglas estrictas — leé esto dos veces

### 3.1. NUNCA toques la rama `vertical/supermercado`

Existe una rama separada, `vertical/supermercado` (remota: `origin/vertical/supermercado`), con **otro cliente real, en producción, que otra sesión de IA está desarrollando activamente ahora mismo, en paralelo**. Es información que aprendiste tarde en esta sesión — al principio hubo un error real (un agente exploró código de esa vertical sin necesidad, y casi se pisa una función real de esa rama por una colisión de nombres en el cliente API — se corrigió a tiempo pero fue un susto real).

**Reglas concretas:**
- Podés LEER esa rama (`git show origin/vertical/supermercado:ruta`) si el dueño te pide explícitamente comparar o buscar ideas — pero **nunca la edites, nunca hagas `git checkout` a ella, nunca corras nada que escriba en su base de datos/tablas si las tuviera separadas**.
- Si estás construyendo algo en `vertical/distribuidora` y ves que un nombre de clase/función/clave de objeto podría colisionar con algo de esa otra vertical (pasó con `SupplierReturn`/`SupplierReturnItem` como clases SQLAlchemy, y con `api.supplierReturns` como clave de objeto en el cliente TS), **verificá con `git grep` antes de asumir que el nombre está libre**. Un objeto TS con dos props iguales no tira error — la segunda pisa a la primera en silencio.
- Si encontrás un bug real en código que pertenece conceptualmente a Supermercado (pasó con `api/src/nemuha_connector/router.py`, que no tiene autenticación en absoluto), **no lo arregles vos**. Reportalo al dueño en texto claro para que se lo pase a la otra sesión.

### 3.2. Preguntá antes de cambios grandes o riesgosos

El dueño trabajó toda esta sesión con un patrón de "preguntame lo que necesites, no asumas nada" para decisiones de diseño/alcance, pero luego, una vez alineado el plan, pidió explícitamente **"segui de manera secuencial, sin aprobación ulterior"** para tandas de trabajo ya acordadas. Replicá ese mismo patrón: al arrancar una tarea nueva o ambigua, confirmá alcance y supuestos; una vez confirmado, no interrumpas cada paso pidiendo permiso de nuevo.

Nunca hagas: `git push --force`, `git reset --hard` sin stashear antes, borrar datos de producción, ni nada irreversible sin decírselo antes al dueño explícitamente.

### 3.3. Nunca commitear secretos

No hay secretos de producción reales sueltos en este repo más allá de las credenciales de entorno dev que ya están en `docker-compose.yml` (committeadas desde antes, no las agregues de nuevo en otro lado). Si en algún momento manejás alguna clave real (ej. si el dueño te pasa algo de Convex/SueldOK, que es un sistema externo relacionado), **nunca la escribas en un archivo del repo ni la commitees** — usarla solo en memoria/variable de entorno de la sesión, tal como se hizo toda esta sesión con la deploy key de Convex.

### 3.4. Siempre verificá con datos reales antes de decir "listo"

Patrón usado en TODA esta sesión y que dio buenos resultados: después de cualquier cambio de backend, probarlo con curl contra datos reales (no mockeados) y comparar contra una query directa a la base — no confiar en que la respuesta 200 de la API signifique que algo quedó bien guardado (ver el bug de `get_db()` en la sección 5, es literalmente esto). Después de cualquier cambio de frontend, pedirle al `curl` directo al módulo de Vite que confirme que compila sin errores antes de decir que está listo.

---

## 4. Cómo levantar/revisar los servicios

Los 4 procesos corren en sesiones `tmux` separadas en el Minisforum. **Esta sesión de tmux se cayó entera al menos 2 veces durante el desarrollo de hoy** (aparentemente frágil — no se identificó la causa raíz, puede ser límite de recursos o timeout de la sesión SSH que lo lanzó). Si algo no responde, chequeá primero:

```bash
ssh minisforum-ia "tmux ls"
```

Si falta alguna sesión o dice "no server running", relanzá TODO con esto (son 4 comandos independientes):

```bash
ssh minisforum-ia "tmux new-session -d -s api -c /home/intellihouse/intelimarket 'source .venv/bin/activate && exec python -m uvicorn api.src.main:app --host 0.0.0.0 --port 8000 --reload 2>&1 | tee -a /tmp/api.log'"
ssh minisforum-ia "tmux new-session -d -s ui -c /home/intellihouse/intelimarket/ui-web 'npm run dev 2>&1 | tee -a /tmp/ui.log'"
ssh minisforum-ia "tmux new-session -d -s inteliforce-gw -c /home/intellihouse/intelimarket 'source .venv/bin/activate && exec python -m uvicorn api.src.inteliforce_gateway:app --host 127.0.0.1 --port 8081 --reload 2>&1 | tee -a /tmp/inteliforce-gw.log'"
ssh minisforum-ia "tmux new-session -d -s cf-tunnel -c /home/intellihouse/intelimarket '/home/intellihouse/bin/cloudflared tunnel --url http://127.0.0.1:8081 2>&1 | tee -a /tmp/cf-tunnel.log'"
```

Verificación rápida de salud:

```bash
ssh minisforum-ia "curl -s -o /dev/null -w 'api=%{http_code}\n' http://localhost:8000/api/v1/companies/00000000-0000-0000-0000-000000000010/products?limit=1"
ssh minisforum-ia "curl -s -o /dev/null -w 'ui=%{http_code}\n' http://localhost:5173"
```

Logs: `/tmp/api.log`, `/tmp/ui.log`, `/tmp/inteliforce-gw.log`, `/tmp/cf-tunnel.log` (todos en el Minisforum, con `tail -N`).

**Frontend web accesible desde el navegador de la Mac del dueño en:** `http://minisforum-ia:5173`

---

## 5. Lo más importante que se hizo hoy — no lo repitas, ya está resuelto

Todo esto está commiteado y pusheado a `vertical/distribuidora` (GitHub: `gustaquevedo-lab/InteliMarket`), en ese orden cronológico (ver `git log`):

1. **Bug crítico de fondo: `get_db()`/`get_tenant_db()` en `api/src/db.py` nunca hacían `commit()`.** Cualquier endpoint que no llamara `db.commit()` explícitamente en su propio código perdía los cambios en silencio (200 OK, pero nada quedaba en la base real). Encontrado comparando contra un fix ya aplicado en la rama de Supermercado (commit `ce2ff71` de esa rama, del 30/07). **Corregido y verificado en vivo** (un `PATCH /customers/{id}` que antes no persistía, ahora sí, confirmado con query directa a psql). **Esto puede explicar bugs silenciosos en CUALQUIER módulo que nunca haya tenido su propio commit** — si ves algo que "no guarda" en un módulo viejo sin tocar hoy, probablemente ya esté resuelto por este fix, pero si ves algo raro en un módulo MUY viejo sin revisar en meses, no asumas que ya andaba mal por otra razón — pudo haber sido justamente esto.

2. **Bug de gating fail-open (`ui-web/src/context/FeatureContext.tsx`):** `hasFeature()` devolvía `true` cuando la lista de features todavía no había cargado (fallo de red, carrera con el login, etc.) — el cliente veía TODOS los módulos de TODAS las verticales en vez de solo la suya. Corregido a fail-closed. También se agregó gating por `user.is_superadmin` a los ítems de menú "Admin SaaS"/"Verticales" que antes cualquier usuario veía sin ningún control.

3. **Motor completo de "cheques y pagarés"** (`api/src/checks/`) con ciclo de vida cartera→depositado→acreditado/rechazado, reversa de AR/crédito al rechazar, cadena de reemplazo. Conectado al flujo de venta y cobros.

4. **Fix de fondo del flujo de venta a crédito**: `sales/service.py` no comiteaba NADA (ni ventas de contado), y el crédito se marcaba como pagado en vez de generar una cuenta por cobrar real. Corregido de raíz, con autorización de excedente de crédito (flujo 409 → aprobación → reintento).

5. **"Inteliforce"**: la app móvil de SueldOK (otro producto del dueño, para asistencia/RRHH) ahora también sirve como frontend de campo para vendedores de Casa Gonzalito — pedidos, metas con desglose, cliente 360°, sync de GPS. Backend en `api/src/inteliforce/`, gateway público angosto en `api/src/inteliforce_gateway.py` (único endpoint expuesto a internet, vía Cloudflare Tunnel). **La app móvil en sí (React Native/Expo) vive en OTRO repo**, en la Mac del dueño en `~/Library/CloudStorage/OneDrive-Personal/Dev/Sueldok` (rama `main`, push a un remoto llamado `inteliforce-integration`, NUNCA a `main` de ese repo — ver detalles en la sección de SueldOK más abajo si el dueño te pide tocar eso).

6. **Motor de indicadores/rebate por proveedor** (`api/src/supplier_kpis/`, pantalla `/proveedor-kpis`): catálogo dinámico de indicadores por período (los indicadores y sus pesos cambian mes a mes según lo que el proveedor le pasa al dueño, no están hardcodeados). Cálculo con piso mínimo, cap al 100% del peso propio, y venta base = ventas reales sin IVA de los productos de ese proveedor. Construido específicamente para el caso de **PARESA (Coca-Cola Paraguay)**, que le acredita al dueño un 4,5% de rebate mensual condicionado al cumplimiento de estos indicadores. **Ver sección 6 — esto está a mitad de camino, es la tarea más importante pendiente.**

7. **Reconciliación de proveedores de julio 2026** (ver sección 6 también): se construyó y pobló `products.supplier_id` (antes no existía ningún campo real de "a qué proveedor pertenece este producto" — todo se inferría). Validado contra la planilla real del dueño: PARESA y Chortitzer cuadran a -0,1%/0,0% exacto. Quedan proveedores chicos sin resolver del todo.

8. **4 features nuevas del roadmap "que este cliente vea los módulos de su vertical"**:
   - Cliente 360° de campo desde el ERP web (botón en `CustomersPage.tsx`, mismo dato que ve el vendedor en el celular).
   - Pantalla `/deposito`: conteo de inventario + recepción de remitos + aprobación de sugerencias de compra (conectó un backend que ya existía pero estaba huérfano).
   - Módulo `/devoluciones-proveedores`: devoluciones A proveedores, construido de cero (ni el legacy ni Intelimarket lo tenían). Genera nota de crédito real del proveedor.
   - Módulo `/bonificaciones-compra`: escalas de bonificación por volumen de compra puntual ("a partir de 100 unidades, 5 gratis"), integrado a la recepción de remitos.

9. **Bug real encontrado y corregido en el camino**: el build del frontend estaba roto (`ui-web/src/api/index.ts`) desde varios commits atrás por una interface TypeScript mal cerrada — nadie lo hubiera notado hasta el próximo build limpio. Ya corregido.

---

## 6. Lo que está a mitad de camino — esto es lo más importante para continuar

### 6.1. Metas de Venta / rebate de PARESA — EN CURSO, esperando información del dueño

El dueño está juntando, **de a partes, en su propio "idioma interno" que necesita traducir primero**, las reglas exactas de cómo PARESA calcula el cumplimiento mensual que determina el 4,5% de rebate. Lo que se sabe hasta ahora (de una planilla real de julio 2026 que compartió):
- Cada mes hay una lista de "indicadores" con peso % propio (ejemplo real de julio: Compras 1%, Ejecución 0,5%, TPM 0,25%, Foco 0,25% — pero esto NO es fijo, cambia mes a mes).
- Cada indicador tiene un piso mínimo (por debajo, aporta 0) y un techo (nunca aporta más que su propio peso aunque se sobrecumpla).
- Hay categorías de producto reales confirmadas externamente (terminología oficial del sistema Coca-Cola, no solo jerga de PARESA): **SSDS** = Sparkling Soft Drinks (gaseosas), **VPO** = Volume Per Outlet, **SS/MS** = Single Serve / Multi Serve (envase individual 250ml-1,5L vs familiar 1L-3L).
- El motor (`api/src/supplier_kpis/`) YA calcula todo esto correctamente — probado con datos reales de julio dio los números esperados (piso, cap, ponderación, prorrateo).
- **Lo que falta**: cargar las metas/resultados REALES de cada indicador de cada mes (hoy solo se cargaron los pesos, de prueba, y se borraron después). El dueño va a ir trayendo esto en partes conforme lo consiga de su gente. **No inventes ni asumas valores — esperá a que te los pase.**
- También pendiente de confirmar con el dueño: si PARESA paga el rebate **prorrateado** por % de cumplimiento (así quedó implementado, `venta_base * rebate_pct_objetivo/100 * pct_cumplimiento/100`) o **todo-o-nada** al llegar al 100%. Preguntáselo cuando tengas más info.
- Falta también: los otros proveedores agrupados como "MIX" (reglas más simples, todavía no compartidas por el dueño), y dos requisitos de negocio que pidió explícitamente y que TODAVÍA NO SE CONSTRUYERON: (a) que el 4,5% de rebate se refleje siempre en los reportes de rentabilidad/margen del negocio, y (b) que al cumplirse una meta se cree automáticamente una obligación de pago de PARESA hacia Casa Gonzalito (una especie de cuenta por cobrar A un proveedor, concepto que no existe hoy en el sistema — sería lo inverso de `supplier_invoices`), por el monto de 4,5% × ventas totales sin IVA del período.

### 6.2. Reconciliación de proveedores de julio — mayormente resuelta, quedan cabos sueltos

Se construyó `products.supplier_id` (columna real, poblada por evidencia de compras históricas, con reglas afinadas en vivo con el dueño: ignorar devoluciones a proveedor, priorizar la compra MÁS RECIENTE sobre el monto histórico total, excluir "Casa Gonzalito" apareciendo como su propio proveedor — dato corrupto de la migración legacy). Validado contra la planilla real: **7 de 18 proveedores dan exacto o casi exacto** (PARESA -0,1%, Chortitzer 0,0%, Lauro Raatz 0,0%, Casa Garcete -0,1%, Parpack 0,0%, Azucarera 0,0% exacto, Fortín -0,6%).

Quedan **3 proveedores sin explicación** (MG SRL +137%, Fontana +168%, Arary +497%) pese a agotar todo lo verificable desde datos: el mapeo producto→proveedor está confirmado correcto (el dueño mismo lo validó producto por producto), no hay bug de duplicación de query, y las notas de crédito ya están netas. La conclusión de esta sesión es que el número de la planilla del dueño para esos 3 proveedores específicos puede estar mal calculado del lado del legacy — pendiente que el dueño lo confirme con su gente. **Si vuelve con más información sobre estos 3, retomá desde ahí, no repitas el análisis desde cero** (está documentado en el historial de chat de Claude, pedile al dueño que te pase el contexto si hace falta).

También quedan **427 productos con proveedor ambiguo** (dos o más proveedores reales compitiendo, sin un ganador claro por evidencia). Se le mandaron 2 CSVs al dueño (`productos_multiproveedor.csv` y una versión corregida) para que los revise a mano — puede que ya haya empezado a corregir algunos productos puntuales (encontró y corrigió en vivo, en esta misma sesión, que APTI es de Gloria y no de PARESA, y que los productos de azúcar son de Azucarera). Si te pide seguir con esto, el patrón es: mostrale la lista, que te diga categoría por categoría o producto por producto quién es el proveedor real, vos actualizás `products.supplier_id` a mano con un UPDATE directo.

### 6.3. Backend sin frontend — 5 gaps identificados, ninguno construido todavía

Auditoría fresca (dos rondas) sobre los ~130 routers de `api/src/main.py`, comparando contra `ui-web/src/api/index.ts` y `ui-web/src/pages/`. Confirmados sin pantalla, priorizados:

1. **`api/src/fiscal/router.py`** — timbrados SIFEN y emisión de Notas de Crédito/Débito fiscales. El cliente API ya existe en `ui-web/src/api/index.ts` (bloque `fiscal`) pero ninguna pantalla lo usa. **Prioridad alta** — hoy no hay dónde emitir una NC/ND fiscal real desde el ERP web.
2. **`api/src/receipts/router.py`** — PDF de factura con QR de CDC (endpoint real: `GET /api/v1/receipts/sales/{sale_id}/pdf`). El cliente en `index.ts` apunta a rutas que **ni siquiera existen** en el backend (`/v1/receipts/${saleId}` en vez de la ruta real) — hay que arreglar el cliente Y agregar el botón de descarga/reimpresión en la pantalla de Ventas.
3. **`api/src/currency/router.py`** — monedas y tipo de cambio por empresa, para compras de importación en USD.
4. **`api/src/security/router.py`** — que el cliente genere/revoque sus propias API keys sin depender de soporte.
5. **`api/src/data_migration/router.py`** — importación masiva de clientes/productos por CSV desde una pantalla.

### 6.4. Gaps de legacy confirmados, todavía sin construir

1. **(Alta prioridad) Vista consolidada de deuda total del cliente.** El legacy sumaba cheques devueltos + cheques en cartera + facturas por cobrar + pagarés en un solo número, con contexto de compra reciente. Hoy en Intelimarket está partido entre `accounts_receivable` y `checks`, sin cruzarse. Evidencia legacy: `A_Pedro/Deudas/Resumen/consulta.asp` (columna `DEUDAS` = suma de las 4 fuentes).
2. **(Media) Reporte de devoluciones DE CLIENTE rankeado por cliente/vendedor** ("quién devuelve más"). No confundir con `supplier_returns` (devoluciones A proveedor, ya construido hoy). Evidencia legacy: `Informes/Devoluciones/Resumen_por_Cliente/consulta.asp`.
3. **(Media-baja) Cuenta corriente de adelantos a empleados** — solo relevante si el dueño sigue dando adelantos en efectivo desde caja fuera de SueldOK.

### 6.5. Auditar bugs que ya se corrigieron en la rama de Supermercado, posiblemente compartidos

Los módulos `api/src/financial/`, `api/src/integrated_finance/`, `api/src/caja/` NO son específicos de ninguna vertical — viven en la raíz de `api/src/`, compartidos. La rama `vertical/supermercado` (que tiene MUCHO más desarrollo reciente en estos módulos específicamente) ya corrigió, según sus mensajes de commit, varios bugs que Distribución probablemente todavía tiene:
- "proyección de flujo de caja nunca tenía ingresos, quedó en 0 filas" (commit `42d2d4e` de esa rama)
- Desglose de caja por forma de pago + cajero + alerta de cash drop (`21405bc`)
- Pagos en USD/BRL guardados como si fueran PYG (`11f0141`)
- Alertas de cobranza/pago vencido con datos reales en "Bóveda" (`d2a9ab0`)

**No copies código de esa rama** (ver regla 3.1) — pero SÍ podés leer sus diffs (`git show <hash>` sobre `origin/vertical/supermercado`) como referencia de qué buscar, y aplicar un fix análogo y propio sobre el código de Distribución, exactamente como se hizo con el bug de `get_db()`. Esto quedó identificado pero **sin auditar todavía si Distribución realmente tiene cada uno de estos bugs específicos** — es el primer paso lógico si retomás este hilo.

También construido en Supermercado y con valor real para adaptar (NO portar literal, construir versión propia): motor de asientos contables automáticos de partida doble (`integrated_finance/auto_posting.py` en esa rama — resume ventas por día, un asiento por factura de compra/pago/cobro, nómina mensual, con idempotencia real) y reportes PDF reales (Estado de Resultados, Balance de Comprobación, Estado de Cuenta).

---

## 7. Otros pendientes menores, de menor prioridad

- **Móvil Inteliforce sin verificar visualmente**: las 3 pantallas nuevas (Pedidos, Metas, Cliente 360°) del lado de la app SueldOK/Inteliforce se construyeron pero nunca se probaron en un dispositivo real ni simulador (Xcode no está instalado en esta Mac). El dueño decidió dejarlo de lado por ahora ("demasiado complicado, vamos a dejarlo por un momento") — no lo retomes salvo que él lo pida explícitamente.
- **`sales_routes.user_id` no cruza con `sales_reps.user_id`** — por eso `/inteliforce/me/routes/today` (rutas del día del vendedor) siempre devuelve vacío aunque el código esté bien. Gap de datos, no de código.
- **`visits.tsx` (del lado de SueldOK) llama a una mutación Convex que no existe** (`routes_v2:updateCustomerLocation`) — pre-existente, no se tocó.
- **`package-lock.json` de SueldOK con diff sin commitear** (de cuando se instaló `expo-notifications`).
- **`api/src/nemuha_connector/router.py` sin autenticación** — es de Supermercado, ya reportado al dueño para que se lo pase a la otra sesión (regla 3.1, no lo toques).
- **Dos sistemas paralelos de "sugerencias de compra"** que parecen redundantes: `api/src/purchases/models.py::PurchaseSuggestion` (el que usa el módulo de Depósito nuevo) y `api/src/demand_forecast/` con su propio `purchase-suggestions`. No se investigó cuál es "el real" — anotado como desconexión a revisar, no resuelto.
- **Funciones duplicadas en `api/src/mobile/service.py`** (`receive_remit`, `approve_suggestions`, `get_mobile_dashboard` están definidas dos veces en el mismo archivo — Python usa la segunda, la primera es código muerto). Pre-existente, no roto, pero sucio — limpiar en algún momento.

---

## 8. Convenciones de commit y push

Toda esta sesión commiteó y pusheó directo a `vertical/distribuidora` (sin PRs intermedios) con mensajes largos en español explicando el QUÉ y el POR QUÉ, formato:

```
tipo(módulo): resumen corto en una línea

Párrafos explicando el contexto, qué se rompía antes, cómo se verificó
en vivo con datos reales, y qué queda pendiente si algo.
```

Replicá ese estilo — es lo que el dueño espera para poder auditar después qué se hizo mientras no estaba mirando.

---

## 9. Si el dueño te pide algo de SueldOK específicamente

Es OTRO producto/repo del dueño (RRHH/asistencia, con clientes propios además de Casa Gonzalito), en `~/Library/CloudStorage/OneDrive-Personal/Dev/Sueldok` en esta misma Mac. Regla no negociable repetida muchas veces por el dueño: **nada debe afectar a SueldOK en producción**. Cualquier cambio ahí es aditivo, gateado por feature flag (`company.featureOverrides`, nunca en el plan default), y se pushea SOLO a la rama remota `inteliforce-integration`, NUNCA a `main` de ese repo (asumido que tiene auto-deploy en Vercel al pushear a `main`). Si no tenés el contexto completo de esto, preguntale al dueño antes de tocar nada ahí — es un área de mucho más riesgo que el propio InteliMarket.

---

## 10. Resumen ejecutivo para arrancar rápido

Si tenés que elegir una sola cosa por dónde seguir sin más contexto: **preguntale al dueño si ya juntó más información de PARESA (sección 6.1)** — es la tarea de mayor valor de negocio en curso. Si no la tiene todavía, andá bajando la lista de la sección 6.3 (backend sin frontend, empezando por Fiscal/timbrados) en el mismo estilo secuencial que se usó hoy: confirmá alcance, construí, probá con datos reales, commiteá con mensaje explicativo, segui al siguiente sin pedir aprobación en cada paso salvo que algo sea ambiguo o riesgoso.
