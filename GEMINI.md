# REGLAS DEL PROYECTO INTELIMARKET (RAMA: vertical/supermercado)

> [!IMPORTANT]
> **ESTE REPOSITORIO Y SESIÓN PERTENECEN EXCLUSIVAMENTE A LA VERTICAL DE SUPERMERCADO (EXTRA SUPERMERCADO).**

---

## 🚫 PROHIBICIONES Y REGLAS ESTRICTAS
1. **NO TOCAR POS NI ELECTRON:** Está terminantemente prohibido modificar, sobrescribir o tocar cualquier archivo de `POS` (`ui-web/src/pages/pos/`) o `Electron` (`electron/`, `main.js`, `main.cjs`, `preload.js`, `preload.cjs`). Cualquier interacción requiere advertencia seria previa y autorización expresa del usuario.
2. **EXCLUSIVAMENTE SUPERMERCADO (EXTRA SUPERMERCADO):** Olvidar por completo la rama distribuidora, Casa Gonzalito y servidores de terceros (como minisforum). Solo se trabaja la vertical de Supermercado con la VM `intellihouse@192.168.0.10` (Tailscale `100.83.91.76`).
3. **NO MEZCLAR DATOS NI VARIABLES:** Toda la interfaz, reportes, datos fiscales (RUC `80150377-9` / Razón Social `GRUPO SANTA TERESA E.A.S.` / Nombre Fantasía `Extra Supermercado Mayorista` / Timbrado `18545636`) y reglas de negocio deben responder a la vertical de Retail & Supermercado.
4. **BLINDAJE DE GIT Y RAMAS (NUNCA STASH A CIEGAS NI CAMBIO DE RAMAS):**
   - La rama activa de trabajo es SIEMPRE `vertical/supermercado` sincronizada con `origin/vertical/supermercado`.
   - Está terminantemente PROHIBIDO ejecutar `git checkout` a otras ramas o hacer `git stash` de cambios sin confirmación previa del usuario.
   - Todo trabajo estable debe consolidarse con commits explícitos (`git commit`), nunca dejarse flotando en el stash.
   - Al iniciar cualquier tarea, se debe verificar que `HEAD` coincida con el último commit de `origin/vertical/supermercado`.
5. **ZONA HORARIA INMUTABLE (AMERICA/ASUNCION - PARAGUAY):**
   - Este sistema opera EXCLUSIVAMENTE para Extra Supermercado en Paraguay.
   - La zona horaria del negocio es SIEMPRE `America/Asuncion` (UTC-4 / UTC-3).
   - Queda TERMINANTEMENTE PROHIBIDO recortar cadenas de fecha directamente desde UTC (`.slice(0, 10)` en frontend) o imprimir fechas en tickets térmicos o reportes PDF con `.strftime()` en crudo sin convertir a `America/Asuncion`.
   - Todo filtro de fechas, arqueos de caja, reportes fiscales y tickets de venta DEBEN procesarse sobre la hora local paraguaya.
6. **LÓGICA INMUTABLE DE ARQUEO, FONDOS Y CIERRE DE CAJA:**
   - **Venta 100% en Guaraníes (PYG):** El supermercado nunca vende en moneda extranjera; las divisas (R$, US$) se aceptan exclusivamente como medios de pago.
   - **Fondos de Apertura Bimonetarios Desglosados:** La cajera recibe su fondo para cambio en Gs. (ej. 500.000) y en R$ (ej. 300.00) por separado. En reportes y pantallas se muestran siempre por separado, nunca unificados ni convertidos a una sola masa.
   - **Devolución de Fondo:** El fondo en R$ (300,00) es un esperado en R$ (devolución del fondo recibido).
   - **Efectivo Esperado en Gaveta:** `Fondo Inicial Gs. + Ventas Netas en Efectivo Gs. (Ventas Totales - Medios No Efectivo) - Retiros/Drops`.
   - **Arqueo Físico Real:** En gaveta se cuentan billetes y monedas en Guaraníes (`DEVOLUCIÓN DE FONDO + Recaudación Gs.`), Reales (`DEVOLUCIÓN DE FONDO + Recaudación R$`) y Dólares (si ingresó US$).
   - **Cotejo No Efectivo:** Se corrobora físicamente la existencia y pertinencia de cada comprobante (Vouchers Bancard, Dinelco, QR, PIX, Extra Club, Transferencias, Cheques).
   - Ver especificación completa y fórmulas en [docs/REGLAS_ARQUEO_Y_CIERRE_CAJA.md](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/docs/REGLAS_ARQUEO_Y_CIERRE_CAJA.md).

7. **DESPLIEGUES ZERO-DOWNTIME Y COMANDOS DE DEPLOY (PROHIBIDO REINICIAR A CIEGAS EN PRODUCCIÓN):**
   - **Frontend (UI / React / Vite):** Se despliega exclusivamente con:
     ```bash
     bash deploy-ui.sh
     ```
     Realiza build atómico y conmuta el enlace simbólico en `/var/www/intelimarket-ui/current`. Cero cortes para cajas.
   - **Backend Producción (FastAPI):** Se despliega exclusivamente con:
     ```bash
     bash deploy-api.sh
     ```
     Aplica migraciones de Alembic y realiza un reinicio secuencial (rolling reload) del cluster dual de producción (puertos `8000` y `8002`) detrás de NGINX. Las cajas activas nunca sufren un 502 ni pérdida de conexión.
   - **PROHIBICIÓN ESTRICTA:** Queda terminantemente prohibido ejecutar `systemctl restart intelimarket-api` a ciegas en horario de atención o levantar procesos `uvicorn` manuales fuera de systemd en producción.
   - **Regla anti-desincronización de variables y modelos:** Toda nueva variable en `.env` debe registrarse en `api/src/config.py` (de lo contrario Settings tumba el API). Cualquier modelo que agregue columnas a la BD debe incluir y aplicar su migración de Alembic antes o en conjunto con el código.

8. **ENTORNO SANDBOX / DESARROLLO VS PRODUCCIÓN:**
   - **Producción (Sagrado):** Puertos `8000` / `8002` detrás de NGINX (`http://192.168.0.10:5173/api` y `http://100.83.91.76:8000`). Esquema `public` de PostgreSQL. Atiende a las cajas 2, 3, 4 y 5 de Extra Supermercado.
   - **Sandbox (Desarrollo y Pruebas):** Cuando el usuario o la tarea pida "trabajar en sandbox" o desarrollar funciones experimentales:
     * **API Sandbox:** Corre en el puerto `8001` (`http://100.83.91.76:8001` y `http://192.168.0.10:8001`).
     * **Base de datos Sandbox:** Esquema `sandbox` (`DB_SEARCH_PATH=sandbox,public`).
     * **Servicio Systemd:** `intelimarket-sandbox-api.service`. Reinicio con:
       ```bash
       sudo systemctl restart intelimarket-sandbox-api
       ```
       (Permitido con NOPASSWD en sudoers).
     * **Regla estricta:** NUNCA sembrar datos de personas reales en el esquema sandbox.
     * En sandbox se puede reiniciar libremente, experimentar con endpoints nuevos y probar sin ningún riesgo para la operación de las cajas físicas.

9. **PRUEBAS AUTOMATIZADAS (PLAYWRIGHT Y WINRM):**
   - **Playwright Local:** No depender del subagente interno del navegador si falla la descarga de binarios de Azure CDN. Utilizar el entorno de Playwright configurado en `tests-pos/` (`node tests-pos/...` o `npx playwright test`), el cual ya cuenta con Chromium instalado localmente y permite validar la interfaz del POS (`http://100.83.91.76:5173/pos`) generando capturas y aserciones.
   - **Control de Cajas Físicas vía WinRM:** Para interactuar, diagnosticar o reiniciar las PCs de las Cajas 2, 3, 4 y 5 (Windows), utilizar el puerto 5985 desde la VM con el helper `/tmp/run_winrm.py` o tareas programadas interactivas.
   - **Evidencia Obligatoria:** Todo cambio en la lógica del POS o del offline-first requiere evidencia real ejecutada (logs, capturas o queries SQL con servidor simulado/apagado) antes de ser considerado completado.

10. **FORMATO CANÓNICO DE MONTOS E INPUTS DE MONEDA (OBLIGATORIO Y DEFINITIVO):**
   - **PROHIBICIÓN ESTRICTA:** Queda terminantemente PROHIBIDO utilizar `<input type="number">` o `<input type="text">` plano sin máscara para importes de dinero (precios, costos, líneas de crédito, cuotas, saldos, desembolsos, anticipos, totales o valores de vales). En HTML nativo, `type="number"` rompe o ignora los separadores de miles de la región.
   - **COMPONENTE CANÓNICO OBLIGATORIO:** Todo formulario de frontend que reciba o edite un monto monetario DEBE utilizar exclusivamente el componente `<CurrencyInput />` (`src/components/CurrencyInput.tsx`).
   - **Formato Paraguay (PYG):** Guaraníes siempre enteros, sin decimales, con separador de miles por punto (`.`), ej: `1.500.000`.
   - **Formato Divisas (USD / BRL):** Con separador de miles por punto (`.`) y centavos por coma (`,`), ej: `1.250,50`.
   - **Visualización en Pantallas / Tablas:** Se debe emplear siempre `formatPYG()`, `formatCurrency()`, `formatBRL()` o `formatUSD()` de `src/utils/format.ts`. Nunca imprimir números crudos sin formato en montos de dinero.

