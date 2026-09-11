# Plan de implementación — Dinelco Checkout

> Estado: **planificado** (no iniciado). Fecha del plan: 2026-09-11.
> Proyecto: InteliMarket (FastAPI + React). Documento de referencia para la implementación.

---

## 1. Objetivo

Integrar la pasarela de pagos **Dinelco Checkout** (Red Dinelco / ENCOM, Paraguay) al ciclo de
vida completo de una venta en InteliMarket:

1. Crear un checkout de pago con tarjeta desde el POS o desde el módulo de cobros.
2. Redirigir al comprador a la página de pago de Dinelco (o abrirla en modal/iframe según lo que soporte la API).
3. Recibir y **verificar** la notificación de resultado (webhook y/o verificación activa).
4. Registrar el cobro automáticamente: crear `Payment` + `PaymentAllocation`, actualizar
   `Sale.total_pagado / saldo / estado`, y reflejar el estado en la transacción `DinelcoTransaction`.
5. Permitir conciliación y reintento desde el admin.

**Resultado de negocio:** una venta pagada con tarjeta a través de Dinelco queda cobrada en el
sistema sin intervención manual, igual que un cobro en efectivo.

---

## 2. Estado actual (baseline del repositorio)

Ya existe un módulo `api/src/dinelco/` completo en su forma, pero **no conectado al negocio** y
con partes especulativas que hay que validar contra la documentación oficial de Dinelco:

| Pieza | Ubicación | Estado |
|---|---|---|
| Servicio de creación de pago | `api/src/dinelco/service.py` (`create_payment`, líneas 27-72) | Existe. Monto entero en PYG, hasta 12 cuotas, URLs derivadas de `APP_URL`. |
| Firma de requests | `dinelco/service.py:22-24` (`_sign_request`) | **Especulativa**: SHA256 de JSON ordenado + secret. **No validada contra la API real.** |
| URL sandbox | `dinelco/service.py:59` | Hardcodeada `https://sandbox.dinelco.com.py/v1` — confirmar con Dinelco. |
| Modelo de transacción | `api/src/dinelco/models.py` (`DinelcoTransaction`) | Existe: `order_id`, `amount`, `status`, `payment_id`, `checkout_url`, `installments`, `auth_code`, `card_last4/brand`, `webhook_data`, `error_message`. |
| Router | `api/src/dinelco/router.py` | `POST /checkout`, `GET /verify/{payment_id}`, `GET /payments`, `GET /config`, `POST /webhook`. |
| Webhook | `dinelco/router.py:69-85` | **Sin autenticación ni verificación de firma.** Recibe JSON `{payment_id, status, auth_code, card_last4, card_brand}` y solo actualiza la transacción. |
| Config | — | Env vars leídos con `os.getenv` suelto. **Ausentes en `api/src/config.py` y en `.env.example`.** |
| Tabla | migración `api/alembic/versions/20260608000000_add_loyalty_bancard_dinelco_email_tables.py` | `dinelco_transactions` ya migrada. |
| Frontend | `ui-web/src/pages/pos/POSPage.tsx:511-521`, `ui-web/src/pages/dinelco/DinelcoPage.tsx`, `ui-web/src/api/index.ts` | Botón + modal Dinelco ya en el POS; página de prueba manual; cliente API `api.dinelco.*`. |
| Tests | `api/tests/test_dinelco.py` | Solo schemas y `_sign_request`. Sin mocks HTTP (no hay respx/aioresponses en el repo). |

### Modelos del dominio que se van a tocar (ya existen, sin migraciones nuevas previstas)

- `payments/models.py`: `Payment` (tiene `gateway_response` JSON listo para guardar la respuesta
  cruda de la pasarela), `PaymentAllocation` (`payment_id → sale_id`, soporta split payments),
  `PaymentMethod` (`tipo`, `config` JSON).
- `sales/models.py`: `Sale` con `total_pagado`, `saldo`, `estado`.
- Lógica de cobro a reutilizar: `sales/service.py:371-421` (`add_payment` — crea `Payment` +
  allocations, actualiza totales y estado, llama a cuentas por cobrar). **No duplicar esta
  lógica: extraerla o invocarla desde el webhook.**

### Referencia interna de calidad

- `api/src/pagopar/` es la pasarela más protocolar del repo: firma HMAC de webhook real
  (`pagopar/service.py:40-47`), portal público en `public_router`. Usarla como patrón.
- `api/src/bancard/`, `api/src/kuapay/`, `api/src/spi/` — otras pasarelas ya integradas en el POS.

---

## 3. Riesgos y supuestos (leer antes de implementar)

1. **La API real de Dinelco Checkout no está verificada.** La firma y el formato del webhook
   actuales son una hipótesis. Primer paso del plan (Fase 0) es conseguir de Dinelco/ENCOM:
   manual técnico, URL base de sandbox y producción, esquema de firma, formato exacto del
   webhook (campos + firma), y credenciales de comercio de prueba.
2. **Drift histórico ORM vs migraciones.** El repo tiene varios commits de corrección de drift.
   Antes de tocar cualquier modelo, comparar contra la migración real que creó la tabla.
3. **Auth inconsistente.** La mayoría de routers de dominio no usan auth (`auth/middleware.py`),
   existe un `demo-token` backdoor, y el multi-tenancy por schema está poco usado. El webhook
   Dinelco es público por naturaleza, pero debe tener **verificación criptográfica** y
   **idempotencia** para compensar.
4. **Doble escritura.** `get_db()` hace commit al final del request (`api/src/db.py:28-37`); si el
   webhook procesa pago + venta, asegurarse de que todo ocurra en una sola sesión/transacción.

---

## 4. Fases de implementación

### Fase 0 — Validación con Dinelco (prerequisito bloqueante)

- [ ] Obtener del área comercial/técnica de Dinelco (Red Dinelco / ENCOM):
  - Manual o spec técnica del checkout (creación de intención de pago, redirección, estados).
  - URLs de sandbox y producción.
  - Mecanismo de autenticación (¿API key header? ¿token? ¿firma HMAC? ¿oauth?).
  - Formato exacto del webhook: campos, cabecera de firma, reintentos del lado de Dinelco, IPs.
  - Credenciales de comercio de prueba.
- [ ] Registrar los hallazgos en este documento (sección "Anexo — Contrato real Dinelco").

**Entregable:** contrato de API verificado. Sin esto no se avanza a las fases 2+.

### Fase 1 — Configuración centralizada

- [ ] Agregar a `api/src/config.py` (pydantic-settings) un grupo `dinelco_*`:
  `merchant_id`, `api_key`, `secret`, `api_url` (sin default hardcodeado en el servicio),
  `sandbox: bool`, `webhook_secret` (si aplica).
- [ ] Documentarlas en `.env.example` (hoy ausentes).
- [ ] Eliminar los `os.getenv` sueltos de `dinelco/service.py` y usar `Settings`.
- [ ] Health check: `GET /api/v1/dinelco/config` ya existe — que reporte `is_configured`
  (no exponer secretos).

### Fase 2 — Servicio de checkout conforme al contrato real

- [ ] Reescribir `dinelco/service.py:create_payment` según el contrato validado en Fase 0:
  - Monto en guaraníes enteros (ya así), moneda, descripción de la orden.
  - `order_id`/`payment_id` idempotente: usar UUID generado por InteliMarket (no aceptar
    duplicados de DinelcoTransaction).
  - `return_url` (redirect del navegador del pagador) y `callback_url`/`notification_url`
    (webhook) derivados de `APP_URL` con path estable.
- [ ] Rehacer `_sign_request` con el esquema real (o eliminarlo si la API usa API key).
- [ ] Persistir la `DinelcoTransaction` en estado `pending` antes de responder.
- [ ] Manejo de errores de red/HTTP de Dinelco: timeout, 5xx → estado `error` + reintento manual.

### Fase 3 — Webhook seguro e idempotente

- [ ] `POST /api/v1/dinelco/webhook` (`dinelco/router.py:69-85`):
  - **Verificar firma** según el mecanismo real (HMAC de body crudo con `webhook_secret`,
    header `X-Dinelco-Signature` o el que indique la spec). Rechazar con 401/400 si falla.
  - **Idempotencia:** si la transacción ya está en estado final (`approved`/`rejected`),
    responder 200 sin re-procesar (Dinelco puede reintentar).
  - Guardar el payload crudo en `webhook_data` (ya existe la columna).
- [ ] Confirmar desde sandbox que Dinelco reintenta y que el endpoint responde en < 5 s.

### Fase 4 — Puente webhook → cobro de la venta (el gap crítico)

Hoy el webhook no toca `Sale`. Implementar en `dinelco/service.py` (nueva función
`settle_transaction`), invocada desde el webhook cuando `status == approved`:

- [ ] Buscar la `Sale` asociada a la transacción. **Decisión de diseño pendiente**: agregar
  `sale_id` a `DinelcoTransaction` (recomendado; migración pequeña) o resolver por `order_id`.
- [ ] Crear `Payment`:
  - `tipo = "tarjeta"`, `payment_method_id` = método "Dinelco" (crearlo vía seed si no existe,
    `PaymentMethod.tipo` + `config` con marca de pasarela).
  - `monto` / `monto_pyg` según la transacción, `moneda = "PYG"`.
  - `referencia` = `payment_id` + `auth_code` de Dinelco.
  - `estado = "confirmado"`.
  - `gateway_response` = payload completo de Dinelco (ya preparado el campo JSON).
  - `user_id` = usuario que originó la venta, o null/sistema para cobros webhook.
- [ ] Crear `PaymentAllocation` (`payment_id → sale_id`, `monto_asignado`) y actualizar
  `Sale.total_pagado / saldo / estado` **reutilizando** `add_payment` de
  `sales/service.py:371-421` o extrayendo su núcleo a una función compartida (evita duplicar
  la lógica de estado y de cuentas por cobrar).
- [ ] Si la venta ya está totalmente pagada por otro canal entre la creación del checkout y el
  webhook: registrar la transacción como `approved` pero sin allocation (o reembolso manual
  documentado). Log + respuesta 200.
- [ ] Transaccionalidad: todo en una sola sesión SQLAlchemy (un solo commit).

### Fase 5 — Verificación activa (complemento al webhook)

- [ ] Endpoint `GET /verify/{payment_id}` ya existe: usarlo desde el frontend para consultar el
  estado cuando el pagador vuelve del checkout (`return_url`), y como reconciliación
  programada.
- [ ] Job de reconciliación con APScheduler (patrón existente en `api/src/scheduler.py`):
  transacciones `pending` con más de N minutos → consultar estado en Dinelco y procesar con la
  misma lógica de Fase 4. Proteger con idempotencia.

### Fase 6 — Frontend

- [ ] POS (`ui-web/src/pages/pos/POSPage.tsx:511-521`): el modal Dinelco ya abre `checkout_url`.
  Completar: estado de espera mientras vuelve el pagador, botón "verificar pago" que llama
  `api.dinelco.verify`, mensajes de aprobado/rechazado/expirado, y cierre de la venta solo
  tras cobro confirmado.
- [ ] `DinelcoPage.tsx` (admin): agregar filtros por estado/fecha, columna de venta asociada,
  acción de re-verificar y de registrar cobro manual con justificación.
- [ ] `ui-web/src/api/index.ts`: ajustar tipos al contrato real.

### Fase 7 — Tests

- [ ] Agregar `respx` (o `aioresponses`) a `pyproject.toml` para mockear httpx.
- [ ] `api/tests/test_dinelco.py` — ampliar:
  - Creación de checkout: request correcto al contrato real, persistencia `pending`.
  - Webhook: firma válida procesa (crea Payment + Allocation + Sale pagada), firma inválida →
    401, reentrega del mismo webhook → idempotente (no duplica Payment).
  - Venta ya pagada → sin allocation, sin crash.
  - Reconciliación: `pending` vieja + `approved` en Dinelco → se asienta.
- [ ] Test e2e del flujo POS→checkout→webhook con la API mockeada (patrón de `test_e2e.py`).

### Fase 8 — Salida a producción

- [ ] Credenciales de producción en el gestor de secretos del deployment (hoy `config.py`/env).
- [ ] Checklist: sandbox end-to-end aprobado con tarjeta de prueba de Dinelco, webhook expuesto
  por HTTPS público, monitoreo de errores del webhook (log + alerta), runbook de reembolso
  manual.
- [ ] Documentar en `docs/INTEGRATIONS.md` (ahí viven los contratos de webhooks hacia otros
  sistemas; agregar el entrante de Dinelco).

---

## 5. Criterios de aceptación

1. Crear un checkout desde el POS abre la página de pago de Dinelco con el monto correcto.
2. Aprobar el pago en sandbox resulta, sin pasos manuales, en: `Payment` + `PaymentAllocation`
   creados, `Sale.total_pagado` actualizado, `Sale.estado` coherente y `DinelcoTransaction`
   en `approved` con payload guardado.
3. Rechazar el pago deja la venta sin cobro y la transacción en `rejected`.
4. Un webhook repetido (reintento de Dinelco) no duplica cobros.
5. Un webhook con firma inválida es rechazado y no altera datos.
6. `make test` verde incluyendo los nuevos tests de dinelco; ruff y mypy sin nuevas
   advertencias en el módulo.

---

## 6. Estimación orientativa (sin ejecutar)

| Fase | Esfuerzo relativo |
|---|---|
| 0 — Contrato real con Dinelco | Bloqueante, depende de tercero |
| 1–2 — Config + servicio | S |
| 3–4 — Webhook + asiento de cobro | M (núcleo del plan) |
| 5 — Reconciliación | S |
| 6 — Frontend | M |
| 7 — Tests | M |
| 8 — Producción | S + coordinación |

---

## 7. Anexo — Contrato real Dinelco (completar en Fase 0)

| Ítem | Valor |
|---|---|
| URL sandbox | _pendiente_ |
| URL producción | _pendiente_ |
| Autenticación | _pendiente_ |
| Esquema de firma | _pendiente_ |
| Header de firma del webhook | _pendiente_ |
| Campos del webhook | _pendiente_ |
| Reintentos del webhook por parte de Dinelco | _pendiente_ |
| Estados posibles de transacción | _pendiente_ |
| Tarjetas/medios soportados | _pendiente_ |
| Contacto técnico Dinelco/ENCOM | _pendiente_ |
