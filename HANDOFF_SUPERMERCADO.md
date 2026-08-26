# HANDOFF VERTICAL SUPERMERCADO — INTELIMARKET

**Cliente piloto**: Extra Supermercado (Pedro Juan Caballero, Paraguay — Grupo Santa Teresa E.A.S.)
**Rama activa**: `vertical/supermercado`
**VM de desarrollo real**: `intellihouse@192.168.0.242` (o Tailscale `100.83.91.76`) — **el IP viejo de la sección de abajo (100.83.91.76 como único acceso) está desactualizado, usar 192.168.0.242 directo**
**Directorio raíz**: `/home/intellihouse/intelimarket`
**Sandbox**: API `:8001` / UI `:5174` (schema `sandbox`) — arrancar con `/home/intellihouse/intelimarket/start-sandbox.sh`
**Producción**: API `:8000` / UI `:5173` (schema `public`) — systemd `intelimarket-api.service` / `intelimarket-ui.service`

---

## 🔒 SESIÓN 2026-08-26 (tarde) — Verificador de Precios: blindaje definitivo contra volver a sandbox / pantalla sin logo

Pedido explícito del cliente, textual: *"nunca mas van a apuntar a sandbox y no quiero volver a ver sin logo y cotizacion, esto debe ser infalible, granitico."* Esto NO es una preferencia estética, es una directiva dura. Cualquier sesión futura que toque los terminales físicos del Verificador debe leer esto ANTES de tocar nada.

### Terminales físicas activas (las 2 que funcionan; la tercera tiene lector roto y sigue sin configurar)

- **`.247`** ("Terminal 1", Windows 10, user `user` / `Extra2026`)
- **`.120`** ("CONSULTOR3", ex-`.234` — **cambió de IP esta sesión**, user `pc` / `Extra2026`). Si no responde en `.120`, puede haber cambiado de IP de nuevo — pedirle al cliente la IP actual antes de asumir que está caída.

Ambas apuntan a **producción** (`http://192.168.0.242:5173/verificador`), nunca a sandbox (`:5174`). Método de gestión: WinRM + NTLM desde la VM (`/tmp/winrm_env`, helper `/tmp/run_winrm.py <ip> <user> <pass> <script.ps1>`). **Relanzar Edge SIEMPRE vía `Start-ScheduledTask -TaskName KioskWatchdog`, nunca `Start-Process` directo por WinRM** — Start-Process directo aterriza en la Session 0 invisible (o, peor, el proceso puede desaparecer solo poco después, confirmado de nuevo esta sesión al testear el self-heal). Técnica para ver la pantalla real (no solo curl/API): registrar una scheduled task one-off con `-LogonType Interactive`, tomar el screenshot a disco, leerlo en base64 vía WinRM normal.

### Qué se blindó (3 capas, no una sola)

1. **`C:\ProgramData\kiosk\watchdog.ps1` (corre cada 5 min vía la tarea `KioskWatchdog`) ya NO solo revisa que Edge esté vivo — ahora verifica el `CommandLine` real del proceso contra la URL de producción exacta, y si no matchea (sandbox, URL vieja, lo que sea) mata Edge y lo relanza correcto.** Probado en vivo: se forzó `:5174` a mano, se corrió el watchdog, se confirmó que se autocorrigió solo a `:5173`. Esto es lo que hace que "apuntar a sandbox" ya no pueda quedar pegado más de 5 minutos, pase lo que pase.
2. **Eliminado el punto de desincronización real que ya había causado el problema una vez**: en `.120` había una copia vieja de `launch.bat` en la carpeta de Inicio de Windows (`%APPDATA%\...\Startup\launch.bat`) que **todavía apuntaba a `:5174`** — un reinicio de esa PC (corte de luz, Windows Update) iba a bootear directo a sandbox sin que nadie lo tocara. Ahora esa copia en Startup ya no tiene contenido propio: solo hace `call "C:\ProgramData\kiosk\launch.bat"` — un solo archivo fuente de verdad, no dos copias que se puedan desincronizar. Verificar esto en la tercera terminal el día que se configure.
3. **La app legacy del sistema anterior (`consulta_preco.exe`, en `C:\ConceptoSistemas\ConsultaDePrecios\`) seguía instalada y corriendo en las 3 terminales, invisible detrás de Edge en modo kiosk.** Se descubrió por accidente: al matar Edge para un test, quedó expuesta una pantalla de "Configuración / IP del Servidor" del sistema viejo. Si Edge se cae aunque sea un instante y el watchdog tarda en relanzar, el cliente vería ESO en vez del Verificador. Se deshabilitó en `.247` y `.120` (renombrado a `consulta_preco.exe.DESHABILITADO_INTELIMARKET`, no se puede ejecutar) y se borraron los accesos directos del escritorio que apuntaban a él. **Pendiente: hacer lo mismo en la tercera terminal cuando se configure.**

### Frontend: reintento rápido en vez de esperar 5 minutos

`PriceCheckerKioskPage.tsx` — tanto `fetchCompanyAndCurrencies` (logo + cotizaciones) como `fetchBanners` ya reintentaban solos cada 5 minutos si fallaban, pero un corte de red pasajero dejaba la pantalla en blanco hasta ese próximo ciclo. Ahora, si el pedido falla (o `company` viene vacío), reintenta a los 5 segundos — la ventana de "pantalla sin logo" pasó de "hasta 5 minutos" a "unos segundos". Commit `9eac02f`.

### Banners: rotación

`BANNER_ROTATE_MS` en la misma página, ahora en `7000` (antes 6000, pedido explícito). Se verificó con un `MutationObserver` en vivo sobre los dots del carrusel que rota exactamente cada 7000ms en el orden correcto — si alguna vez parece "trabada" al mirarla 20-30 segundos, esperar un ciclo completo antes de asumir que está rota (se confirmó por experiencia propia que 2 capturas de pantalla mal espaciadas pueden coincidir en el mismo banner por pura casualidad de timing).

### Layout del Verificador (standby): cotización a la izquierda, banner completo a la derecha

Los creativos reales de Marketing son **verticales** (formato tipo Instagram ~4:5), no 16:9 horizontal. Se movió la "PIZARRA DE CAMBIO OFICIAL" a la columna izquierda (junto al logo), se sacó el pill "VERIFICADOR DIGITAL INSTANTÁNEO", y el banner ahora usa `object-contain` (se ve completo, sin recortar) en vez de `object-cover`. El hint de dimensiones del uploader en `MarketingAgentPage.tsx` ya dice formato vertical. Commits `998d828` (layout) y `bc1d865` (7s).

### Si algo de esto vuelve a fallar

No asumir que es un bug de código nuevo — primero chequear, en este orden: (1) `launch.bat` en `C:\ProgramData\kiosk\` en la terminal específica (¿dice `:5173`?), (2) si hay una copia en Startup desincronizada, (3) si `consulta_preco.exe` volvió a aparecer (no debería, no tiene mecanismo de auto-inicio conocido, pero no se descarta que alguien la reinstale o la abra a mano), (4) recién ahí sospechar del código del Verificador.

---

## ⚖️ SESIÓN 2026-08-26 — INTEGRACIÓN BALANZAS BALMAK EDGE (carnicería/panadería), investigación profunda

Pedido: automatizar sync de PLU/precio hacia las balanzas Balmak Edge de carnicería y panadería (**no** la báscula de checkout — esa ya está integrada y funciona, es un flujo aparte). Se hizo una investigación a fondo, con hallazgos reales que cambian el diseño original. Documentado acá para que ninguna sesión futura repita el camino equivocado.

### Lo que se corrigió en código (commiteado)

El módulo `api/src/integrations/scales/` estaba **muerto desde su creación**: `scale_configs.marca/protocolo/conexion` declarados como `SAEnum` en el modelo, pero ese tipo Postgres nunca existió (columna real = varchar) → ningún `ScaleConfig` se pudo crear jamás vía API, ni siquiera las 2 filas reales ya cargadas a mano (`Balmak Edge · Carnicería`, `Balmak Edge · Panadería & Rotisería`, protocolo `balmak_etiquetadora`, tampoco registrado en `DRIVER_REGISTRY`). Mismo patrón que el bug de WhatsApp de la noche anterior — ver [[bug-patron-enum-sin-tipo-postgres]] en la memoria de la sesión de Claude. Se corrigió, se agregó `categorias_ids` a `ScaleConfig` para acotar qué categoría de producto sincroniza cada balanza, y se agregó disparo automático (`auto_sync_product`, en `products/router.py`) cada vez que cambia `precio_venta`.

También se corrigieron 3 `AttributeError` latentes (`Product` no tiene `codigo` ni `codigo_barras`, son `sku`/`codigo_barra`).

### El hallazgo grande: el software real es SDL, y ya está funcionando EN VIVO

Vía WinRM a la PC de Compras (`192.168.0.231`, usuario `dpto. compras 02`) se encontró el acceso directo **EDGE** del escritorio, que apunta a `C:\Program Files (x86)\EDGE\EDGE\SDL.exe` — el software real del fabricante (Novatek/SDL), no algo inventado.

**El mecanismo real NO es "dejar un archivo en una carpeta compartida"**: SDL.exe corre en esa PC y empuja los PLU directo por TCP a las balanzas físicas, en un loop automático. Confirmado en el log de HOY (`LogFile\20260826.Log`):

```
08:21:09  192.168.0.72:4011  Baixar dados → Atualizar o banco de dados → PLU 10/10 (100%) Sucesso
08:21:09  192.168.0.73:4001  Baixar dados → Atualizar o banco de dados → PLU 10/10 (100%) Sucesso
08:21:09  192.168.0.74:4010  Baixar dados → Atualizar o banco de dados → PLU 10/10 (100%) Sucesso
```

Es decir: **3 balanzas físicas activas** en `192.168.0.72/.73/.74` (puertos 4011/4001/4010), sincronizando en ciclos de minutos, con éxito, ahora mismo. Las IPs que había cargadas en `scale_configs` (`192.168.1.150`/`.151`) son **incorrectas** — se limpiaron (`host = NULL`) en vez de dejarlas apuntando a algo que no existe. **No se pudo determinar con certeza qué IP física corresponde a qué balanza/departamento** — los 3 ciclos del log muestran el mismo conteo de PLU en simultáneo para las 3 IPs, lo que sugiere que podrían estar recibiendo el mismo catálogo combinado en vez de uno por departamento. Requiere confirmación física en el local (mirar cada balanza) antes de asumir nada.

**SDL guarda su catálogo en `SDL.mdb`** (Access, protegido con contraseña — hardcodeada en texto plano en `SDL.exe.config` (no reproducida acá, ver notas internas de la sesión), la misma en las 24 carpetas de configuración `Include\SDL901-906\SDLE01-06\SDLP01-06\SDLT01-06`, aunque solo 3 unidades están físicamente activas). La integración correcta a futuro probablemente sea escribir/leer contra esa base (o usar el import de archivo que ya trae el propio SDL), **no** reimplementar el protocolo TCP de las balanzas — eso ya lo hace SDL.exe y ya funciona.

### Formato de archivo real (para exportación PLU vía import de SDL)

Se extrajo `SDLtxt.tmp` (348 filas reales) y se decodificó byte a byte — implementado en [`balmak_edge.py`](api/src/integrations/scales/drivers/balmak_edge.py):

- Registro de **284 bytes**, `CRLF` entre filas, codificación **CP1252**.
- `[0:2]` = `"01"` constante · `[2:9]` = PLU (7 dígitos) · `[9:18]` = precio × 1000 (9 dígitos) · `[18:68]` = nombre (50 chars) · `[68:284]` = cola de campos opcionales, idéntica en las 348 filas reales (se replica tal cual).

**Trampa encontrada y corregida**: el PLU **no es global** — cada una de las 24 unidades SDL numera su propio catálogo empezando de nuevo en 1 (`"1000001"` aparece 80 veces en el archivo real, para productos totalmente distintos). Se intentó un primer backfill de `products.plu_balanza` (campo nuevo, migración `20260826150000`) cruzando por nombre contra InteliMarket — **se deshizo** (`UPDATE ... SET plu_balanza = NULL`) al descubrirse el problema. La columna quedó en el modelo, vacía, a la espera de decidir el diseño correcto (probablemente una asignación por producto × balanza, no un campo único en `products`).

### ✅ CORRECCIÓN (misma noche, después de seguir investigando): el PLU SÍ es global — la fuente de antes estaba mal

Lo de arriba ("el PLU no es global, cada unidad numera desde 1") era un diagnóstico equivocado, basado en `SDLtxt.tmp` — que resultó ser un archivo viejo/de prueba, no la fuente real. Se encontró la fuente de verdad real: **`SDL.mdb`** (Access, protegido con password -- visible en texto plano en `SDL.exe.config`, no reproducida acá), consultada directamente vía WinRM + PowerShell de 32 bits (`C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`, el Jet OLEDB de 4.0 es de 32 bits, la sesión WinRM por defecto es de 64 y falla si no se fuerza esa ruta):

```powershell
$conn.ConnectionString = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\Program Files (x86)\EDGE\EDGE\SDL.mdb;Persist Security Info=True;Jet OLEDB:Database Password=<ver notas internas>"
```

La tabla `PLU` tiene **505 filas, PLUID único de verdad** (enteros chicos: 1, 2, 3... hasta 983, no 7 dígitos). La tabla `Dept` (3 filas: T-Weight/T-Count/Service Charge) **no es departamento físico** — es el modo de venta (peso/unidad/cargo de servicio) de SDL, nada que ver con carnicería vs panadería. Las 3 IPs activas del log (`192.168.0.72/.73/.74`) reciben el **mismo catálogo completo** las tres — son 3 cabezales físicos mostrando el mismo catálogo único, no un catálogo por departamento.

**Con esta fuente correcta se rehizo el cruce por nombre contra InteliMarket: 249 matches exactos, cero colisiones de PLU (a diferencia del intento anterior). Ya aplicado a `products.plu_balanza` en producción** (245 escritos, 4 productos con conflicto real detectado y saltados a propósito — ver abajo). Quedan 15 ambiguos + 223 sin match para revisar con el cliente — puede ser fruta/verdura que InteliMarket todavía no tiene cargada, o nombres que no matchean por escritura distinta.

**4 conflictos reales encontrados** (el backfill los saltó, no los pisó): 2 filas de SDL apuntando al mismo nombre normalizado de producto en InteliMarket con 2 PLU distintos cada una (`MANDIOCA C/ CASCARA KG` y `UVA ITALIA KG` aparecen duplicados en la tabla `PLU` de SDL con el mismo nombre) — puede ser una entrada vieja sin borrar en SDL, o dos variantes reales (por peso vs por unidad) que InteliMarket todavía no distingue como productos separados. Confirmar con el cliente antes de decidir cuál PLU es el vigente.

**Pendiente actualizado** (reemplaza el punto 2 de la lista de arriba, los demás siguen iguales):
2. ~~Decidir el diseño de PLU por-balanza~~ → ya no aplica, el PLU es global. Falta: revisar con el cliente los 15 ambiguos + 223 sin match (archivo `PLU_para_revisar.csv` entregado en el chat de esa sesión), y resolver los 4 conflictos reales antes de completar el backfill al 100%.

### ✅ CORRECCIÓN 2 (misma noche): match por código de barras, no por nombre — 504/505

El cruce por nombre (arriba) fue un rodeo innecesario. Ñemuha ya venía guardando el PLU real embebido en `products.codigo_barra`: convención `"2000" + PLU con 3 dígitos` (ej. barcode `2000019` = PLU 19). Confirmado con 916 productos reales que siguen ese patrón exacto (`^2000[0-9]{3}$`).

Se rehizo el backfill cruzando `codigo_barra` directo contra la tabla `PLU` real de `SDL.mdb` (505 filas): **504 de 505 PLU reales quedaron enlazados** (el barcode ganó sobre los 4 casos donde el match por nombre anterior había acertado mal — ej. `ML COSTILLA DE PRIMERA/MATAMBRE KG` se había matcheado por nombre al PLU 736 por error de normalización; el barcode confirma que es el PLU 7 correcto).

**Quedan 6 PLU reales sin producto asociado** (de 505): PLU 482 (fila vacía en SDL, no es un producto real), PLU 141 "UVA CRINSON" y PLU 572/573 (precio en 0 en SDL, probablemente cargas incompletas/de prueba), PLU 983 "BROA DE MAIZ UND" y PLU 951 "...A TERESA TORTA ARTESANAL UND" (precio real, productos que probablemente todavía no tienen su código `2000xxx` correspondiente cargado en InteliMarket — revisar si existen con otro código o si falta cargarlos).

**Los 412 productos de InteliMarket con barcode `2000xxx` que NO tienen PLU real correspondiente no son un problema** — son SKUs internos sin relación con la balanza (pilas, bolsas plásticas, medicamentos, canastas básicas): la convención `2000` + número se usa en Ñemuha para cualquier SKU generado internamente, no exclusivamente para artículos de balanza. Se descartaron correctamente al cruzar contra el catálogo real de 505.

**Conclusión para el corte Ñemuha → InteliMarket**: el vínculo producto↔PLU ya está resuelto al 99.8% con evidencia directa (no adivinado), listo para el día del corte sin fricción para el personal de balanza.

### 🎯 SESIÓN 2026-08-26 (noche, continuación): intento de automatizar el ENVÍO a la balanza — investigado a fondo, no resuelto todavía

Pedido del cliente: que al cambiar el precio de un producto pesable, se transmita **solo** a la balanza, sin que nadie tenga que entrar a mano al software SDL y apretar "Subir" (proceso hoy 100% manual, descrito por el cliente como "engorroso, lento y pasible de errores").

**Se descartó (probado en vivo, seguro, reversible):**
- Escribir directo en `SDL.mdb` (Access) funciona sin bloqueos -- se probó insertar/borrar una fila de prueba (`PLUID=9999`) mientras SDL.exe corría, sin errores.
- **Pero escribir en la base NO alcanza**: SDL.exe no tiene un loop de sincronización continuo. El único envío real del día (08:21-08:46) coincidió con el arranque del proceso (`StartTime 08:00:37`); a las 16:21 (mismo día, proceso corriendo) no había pasado nada más. No hay ninguna tarea programada de Windows relacionada (`Get-ScheduledTask` no encontró nada con SDL/EDGE/Balan). El `AutoTask.xml` de la app tiene fechas de fábrica (2001/1999) — nunca se configuró un timer real.
- **Se encontró el mecanismo real por reflection de .NET** sobre `SDL.App.dll` (sin decompilar, usando `[System.Reflection.Assembly]::LoadFrom` + `GetTypes()/GetMethods()` vía WinRM): la clase `SDL.App.NetForm` tiene `uploadButton_Click` → dispara `NetworkAction.UploadSDL` (enum con `UploadInfo/DownloadInfo/UploadTime/UploadSDL/DownloadSDL/UploadReport/UploadMdb/DownloadMdb/DownloadCSV/PingDevice`, entre otros). Esto confirma que el proceso manual que describe el cliente es literalmente: abrir esa pantalla y apretar ese botón.
- **Se intentó invocar `UploadSDL` sin abrir ventana** (crear `NetForm` en memoria, headless, y leer su estado) — **falló con `NullReferenceException` en el constructor mismo**. `NetForm` depende de estado global del proceso `SDL.exe` ya corriendo (conexión ya abierta a `SDL.mdb`, singletons de la app cargados al arrancar) — no es invocable en frío desde un proceso nuevo. Ir más allá de esto requeriría inyectarse dentro del proceso real de SDL.exe en producción, que no se intentó (riesgo real sobre software de un tercero en producción, requiere autorización explícita).

### Decisión con el cliente: reverse-engineering del protocolo de red, como proyecto aparte

Se evaluaron 3 caminos con el cliente:
1. Automatizar el click real de la UI (usuario/horario de servicio dedicado, para no chocar con el uso normal de la PC de Compras) -- más rápido de lograr, pero sigue dependiendo de SDL.exe.
2. **Reverse-engineering del protocolo TCP real** (puertos `4001`/`4010`/`4011`, confirmados activos hacia `192.168.0.72/.73/.74` en el log) — reemplazaría a SDL.exe por completo, la solución más limpia a largo plazo. **Elegido por el cliente**, pero es scope de una sesión dedicada aparte (captura de tráfico real durante un envío + decodificación de un protocolo binario propietario).
3. Frenar la automatización de envío por ahora, quedarse con lo ya resuelto (PLU vinculados 504/505 en `products.plu_balanza`).

**Se eligió la opción 2.** Próxima sesión dedicada a esto debe:
- Capturar tráfico real (tcpdump/Wireshark) durante un `uploadButton_Click` real hacia `192.168.0.72:4011` / `.73:4001` / `.74:4010` (coordinar con el cliente el momento, para tener certeza de qué tráfico corresponde a qué acción).
- Decodificar el formato del paquete (probablemente TCP simple, dado el patrón de log "Baixar dados → Atualizar o banco de dados → PLU X/X Sucesso" sugiere un protocolo de aplicación propio sobre TCP, no HTTP/FTP).
- Construir un cliente propio en InteliMarket (Python) que hable ese protocolo directo, sin pasar por SDL.exe ni por Windows.
- **Credenciales/accesos ya documentados para retomar**: WinRM a `192.168.0.231` (user `dpto. compras 02`, clave no reproducida acá -- pedirla al usuario), PowerShell de 32 bits en `C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe` para usar Jet OLEDB. La password de `SDL.mdb` está hardcodeada en texto plano dentro de `SDL.exe.config` en la propia máquina -- consultarla ahí en vez de guardarla en este repo.

**Cuidado para la próxima sesión**: esa PC la usa una persona real de Compras en horario de trabajo (se la vio en vivo trabajando en el legacy durante esta sesión, sesión de consola activa `DPTO. COMPRAS 02`) — cualquier prueba que interactúe con la UI (no solo lectura de red/DB) debe coordinarse para no interrumpirla.

### Pendiente para la próxima sesión

1. ~~Confirmar qué balanza es cuál~~ → ya no es necesario, el catálogo PLU es único y global para las 3 (ver corrección de arriba).
2. ~~Decidir diseño de PLU por-balanza~~ → resuelto, PLU es global. `products.plu_balanza` ya tiene 504/505 productos reales enlazados por código de barras.
3. Resolver los 6 PLU reales sin producto (482 vacío, 141/572/573 precio 0, 983/951 probablemente sin cargar en InteliMarket) — confirmar con el cliente.
4. Evaluar si integrar contra `SDL.mdb` directamente (más robusto, pero DB Access protegida) o seguir con archivo de import (más simple, pero requiere confirmar qué carpeta/mecanismo dispara la importación real — no se encontró ningún archivo generado en `C:\ConceptoSistemas\Balancas`, el parámetro del legacy `DESTINO_ARQUIVOS_INTEGRACAO_BALANCA` parece no estar realmente en uso).
5. Acceso usado: WinRM a `192.168.0.231`, usuario `dpto. compras 02`, ver con el usuario si conviene un usuario de servicio dedicado en vez de reusar el de Compras.

### ✅ SESIÓN 2026-08-26 (continuación) — protocolo capturado y decodificado, cliente TCP implementado

Retomado el mismo día. Se coordinó con el cliente un envío real desde SDL.exe y se capturó tráfico de dos formas:

1. **tcpdump pasivo desde la VM** — falló: la VM está en la misma LAN (`192.168.0.242`) pero el tráfico unicast `.231`↔balanzas no llega a su puerto de switch (no hay port mirroring). Solo se vio broadcast/multicast de `.231`.
2. **`pktmon` nativo de Windows, corrido vía WinRM en la propia PC de Compras** (`192.168.0.231`, filtrado a las 3 IPs de balanza) — funcionó. Sin instalar nada de terceros (no Npcap/Wireshark), capturó el envío real completo, se convirtió a `.pcapng` con `pktmon pcapng` y se bajó a la VM por `smbclient` contra el share `C$` (mismas credenciales WinRM). Archivos temporales borrados de la PC de Compras al terminar.

**El protocolo real NO es binario** (la hipótesis del `SDLtxt.tmp` de 284 bytes de la sesión anterior queda obsoleta) — es **texto plano, BOM UTF-8, líneas `\r\n`, campos tab-delimited**:

```
UPL\tINF\t\r\n                                                    → pide info de la balanza
  resp: DWL\tINF\t\r\nINF\t<depto>\t<depto>\t1\t<modelo>\t0\t1\t<serial>\t\r\nEND\tINF\t\r\n
DWL\tTIM\t\r\nTIM\t<dd>\t<mm>\t<yy>\t<hh>\t<mi>\t<ss>\t\r\nEND\tTIM\t\r\n      → sincroniza hora
  resp: DWL\tTIM\t<YYYYMMDDHHMMSS>\t1\r\nTIM\t...\r\nEND\tTIM\t1\t\t\r\n
DWL\tPLU\t\r\n\r\n<record>\r\n<record>...\r\nEND\tPLU\t\r\n               → carga catálogo completo
  resp: DWL\tPLU\t<YYYYMMDDHHMMSS>\t1\r\nEND\tPLU\t1\t\t\r\n
```

Cada `<record>` PLU tiene **148 campos** tab-delimited, constantes en las 505 filas reales capturadas salvo 3: PLUID (campo 1), precio formato `<entero>,0` (campo 5) y nombre (campo 15).

**Confirmado por INF real de cada balanza** (resuelve la duda pendiente de la sesión anterior sobre qué IP es cuál):
- `192.168.0.72:4011` → **CARNICERIA1**
- `192.168.0.73:4001` → **PANADERIA**
- `192.168.0.74:4010` → **CARNICERIA**

Es decir, hay **2 cabezales físicos de Carnicería** (`.72` y `.74`) y **1 de Panadería** (`.73`) — no 1 y 1 como asumían las 2 filas actuales de `scale_configs`.

**Implementado en [`balmak_edge.py`](api/src/integrations/scales/drivers/balmak_edge.py)**: `BalmakEdgeDriver` reescrito para hablar este protocolo por TCP directo (sin SDL.exe, sin Windows). `test_connection()` probado en vivo contra las 3 IPs reales (INF real, solo lectura) — funciona. `sync_plu()` construye el mismo bloque `DWL/PLU` byte-a-byte compatible con lo que la balanza ya acepta (plantilla de 148 campos extraída y verificada carácter por carácter contra la captura real) — **implementado pero todavía NO probado en vivo contra el catálogo real** (evitado a propósito: escribiría sobre el catálogo de producción que usa el personal ahora mismo).

**Pendiente para la próxima sesión**:
1. Probar `sync_plu()` en vivo — idealmente con 1 producto de prueba contra una sola balanza, coordinado con el cliente, antes de habilitar `sync_automatico` de verdad.
2. Decidir cómo modelar los 2 cabezales de Carnicería en `scale_configs` (agregar una 3ra fila "Carnicería · Cabezal 2" con host `.74`, o alguna otra estrategia) — hoy la tabla asume 1 host por fila.
3. Cargar `host`/`puerto_tcp` reales en las 2 filas existentes (hoy vacío): Carnicería → `192.168.0.72` puerto `4011` (o `.74`/`4010` si se resuelve el punto 2), Panadería → `192.168.0.73` puerto `4001`.
4. `sync_time()` no se automatizó (no hay evidencia de que la balanza lo exija antes de aceptar PLU) — si en producción se detecta que hace falta, agregar esa llamada antes del push.


## 🚨 SESIÓN 2026-08-26 (TARDE) — Verificador de Precios movido a PRODUCCIÓN, no volver a sandbox

**Decisión explícita del usuario**: las terminales físicas del salón ahora apuntan a **producción** (`http://192.168.0.242:5173/verificador`), no a sandbox. El usuario pidió expresamente no volver a tocar esto ("no volvamos a tocar lo que funciona") — **cualquier cambio futuro al Verificador de Precios se prueba en sandbox primero, pero el URL de las terminales físicas ya NO se toca sin pedido explícito.**

**Por qué se cambió**: el usuario cargó un banner de marketing y no aparecía en las pantallas — cargó en producción (el sistema que usa por costumbre) mientras las terminales apuntaban a sandbox. Dos bases de datos separadas, confusión real y repetida. Se decidió unificar en producción de una vez.

**Qué se hizo para el cambio**:
1. Se restartearon `intelimarket-api.service` e `intelimarket-ui.service` (con `sudo -n systemctl restart intelimarket-api` / `intelimarket-ui`, permitido sin contraseña) para que producción tenga todo el código del Verificador (antes nunca se había reiniciado con este trabajo adentro).
2. **`public.companies.config.currencies` no tenía los flags `activo` por moneda** (ese fix solo se había aplicado a `sandbox` vía API). Se corrigió directo por SQL (ver `UPDATE public.companies SET config = jsonb_set(...)`, cast `config::jsonb` porque la columna es `json` plano, no `jsonb`). Sin esto, producción hubiera mostrado los 3 tipos de cambio como inactivos (pizarra vacía) apenas se cambiara el URL.
3. El banner que el usuario había cargado en producción (`public.kiosk_banners`, id `90d3228c-...`) se copió también a `sandbox.kiosk_banners` para que quedaran sincronizados mientras se probaba.
4. **Bug real encontrado y corregido**: `PriceCheckerKioskPage.tsx` pedía el logo y las cotizaciones **una sola vez** al montar, sin reintento (`useEffect(..., [])`) — a diferencia de los banners, que ya reintentaban solos cada 5 min. Si ese único pedido fallaba por cualquier corte de red pasajero (hubo varios cortes reales de LAN/Tailscale esta sesión), la pantalla quedaba sin logo ni cotizaciones **para siempre** hasta un reload manual. Commit `e38059a`: ahora se repite cada 5 min igual que los banners, autoreparándose sola.
5. Terminales físicas: `launch.bat` reescrito para apuntar a `:5173` en vez de `:5174`, mismos flags de siempre + `--remote-debugging-port=9222 --remote-allow-origins=*` agregado para poder depurar la consola real a distancia sin adivinar la próxima vez.

**Estado de las terminales**:
- `192.168.0.234` (usuario `pc`, host `CONSULTOR3`) — **pendiente de cambiar a producción.** Estuvo inalcanzable por WinRM (`No route to host` en el puerto 5985) toda la sesión pese a que el usuario reportó ver la pantalla funcionando (sandbox, banner visible) — el canal de gestión remota está caído aunque la app siga corriendo. Reintentar `nc -zv -w5 192.168.0.234 5985`; cuando responda, correr el mismo `switch_to_prod.ps1` que se corrió en `.247` (ver abajo).
- `192.168.0.247` (usuario `user`, host `CONSULTOR1`) — ✅ cambiada a producción y verificada end-to-end desde la propia máquina (`Invoke-WebRequest` contra `:5173/api/v1/kiosk/lookup` y `/api/v1/companies`, ambos 200).

**Script para cambiar una terminal a producción** (queda en `/tmp/switch_to_prod.ps1` en la VM, correr vía el helper `/tmp/run_winrm.py <ip> <user> <pass> /tmp/switch_to_prod.ps1`): reescribe `launch.bat` con el URL de `:5173`, mata Edge, y relanza vía `Start-ScheduledTask -TaskName KioskWatchdog` (nunca `Start-Process` directo por WinRM — ver el gotcha de Sesión 0 documentado más abajo).

**Conectividad de esta tarde**: hubo cortes intermitentes reales tanto de `192.168.0.242` (LAN) como momentos donde solo `100.83.91.76` (Tailscale) respondía, y viceversa — coherente con la nota de la sección de arriba (noche del 25). Confirmar ambos caminos antes de asumir que el VM está caído.

---

## 🚨 SESIÓN 2026-08-26 — Dashboard overhaul + nota de conectividad

**Conectividad**: la nota de arriba dice usar `192.168.0.242` directo porque Tailscale estaba desactualizado -- en esta sesión fue al revés, `192.168.0.242` (LAN) estuvo inalcanzable un buen rato y `100.83.91.76` (Tailscale) fue el único camino que funcionó. **Conclusión: no asumir cuál de los dos funciona, probar ambos si uno falla.**

**Qué se hizo**: overhaul completo de `Dashboard.tsx` (commit `92e69ff`, ya pusheado). Antes tenía datos inventados presentados como insights de IA en tiempo real -- "+12.4%" de proyección, "18.5 días" de cobertura de liquidez (repetido 2 veces), "+40%" estacional, "+8.5%" en la tarjeta de Ventas, badges "Óptimo"/"Solvente" fijos -- y texto de otro cliente/vertical bakeado en el commit ("Casa Gonzalito — Distribuidora & Mayorista", 3 veces). También se encontró (y arregló) `Layout.tsx` con una insignia "DISTRIBUIDORA" pisada sin commitear encima de "Versión: Supermercado" por otra sesión concurrente -- **se conservó el resto de ese diff**, que era un selector de sucursales real y funcional que esa sesión había dejado sin commitear, no tenía nada que ver con la contaminación.

Reemplazos con datos reales:
- El gráfico de tendencia (venta actual vs semana pasada vs meta) ahora usa `/api/reports/sales/chart-comparison`, un endpoint que ya existía en el backend con cálculo real (mismo día de la semana anterior, meta = mismo período del mes pasado +10%) y nunca se llamaba desde el frontend.
- Las 4 tarjetas fijas de "AI Executive Briefing" se reemplazaron por 3 tarjetas reales: anomalías (`demand_forecast/anomalies`), clientes en riesgo de fuga (scoring RFM real de `customer360/dashboard`), sugerencia de compra IA (`demand_forecast/purchase-suggestions`) -- motores que ya existían en el backend y nunca se mostraban en ningún lado.
- Selector de rango de fechas custom (calendario) agregado junto a los presets Hoy/7d/30d/Mes.

**Patrón reforzado una vez más**: `Dashboard.tsx` y `Layout.tsx` son archivos compartidos entre verticales y siguen colisionando en vivo -- antes de tocarlos, siempre `git status --short` + `git diff` primero para separar contaminación real de trabajo legítimo sin commitear (como pasó acá con el selector de sucursales).

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
