# Pago mixto — Etapa 1 (endurecimiento): diseño

- **Fecha:** 2026-10-10
- **Rama:** `vertical/supermercado`
- **Estado:** diseño aprobado en conversación, pendiente de revisión del dueño sobre este documento.
- **Alcance de este documento:** solo la Etapa 1. La Etapa 2 (lista unificada de líneas) tendrá su propio diseño.

## 1. Contexto y objetivo

En el POS (Electron, `ui-web/src/pages/pos/POSPage.tsx`) un cliente no puede repartir una venta entre varias líneas del mismo proveedor, por ejemplo Bancard débito + crédito + QR. Además el flujo de pago mixto tiene comportamientos que el dueño no quiere (cobros que no quedan registrados, ventas que cierran sin cobro aprobado).

**Objetivo de la Etapa 1:** que ningún camino pueda cerrar una venta con un cobro sin aprobar, duplicado o sin rastro, y que cada línea de pago quede atada a su cobro real del terminal. No se cambia el modelo de líneas de pago (eso es la Etapa 2).

**Decisiones del dueño registradas:**
- Se encara en dos etapas: primero endurecer, después la lista unificada.
- Si una venta llega al servidor con pagos que no suman el total, el servidor **guarda y marca a revisión**; nunca rechaza (para no perder ventas ya cobradas ni trabar la cola offline).

## 2. Evidencia (auditoría en solo lectura, 2026-10-10)

El POS modela el pago como un `Set` de métodos activos (`activeMethods`), un monto por método (`mixedCardPyg`, `mixedDinelcoPyg`, `mixedQrPyg`, `mixedPlugPayPyg`, ...) y un arreglo `extraPaymentLegs` para repeticiones del mismo método. Los botones de método visibles son solo `cash`, `bancard`, `dinelco`, `plugpay`, `extra_club` y `otros`. El QR y el Parcelado son sub-métodos de Bancard o Plug Pay; no hay botón `qr` ni `plugpay_credito`.

| # | Hallazgo | Evidencia |
|---|---|---|
| 1 | Las guardas de "cobro aprobado" viven en el `onClick` del botón (`POSPage.tsx` ~13757), no en `handleProcessCheckout`. El doble-Enter (`handleMixedFieldKeyDown`, `handleCashFieldKeyDown`) y el camino del supervisor llaman a `handleProcessCheckout()` directo. "Recibido" suma montos cargados, no aprobados. | Código |
| 2 | `activeMethods` nunca contiene `qr` ni `plugpay_credito`. Las líneas extra de esos métodos (botones "+ Agregar otro QR" y "+ Agregar otro crédito parcelado") no se suman a "recibido" ni se envían en `salePaymentsForCreate`, pero la guarda `legPendiente` exige que estén aprobadas. Se puede cobrar de más sin registrarlo. | Código |
| 3 | `posTerminalTransactions.update(..., { sale_id })` se llama una sola vez (~8092), solo con `bancardTxnLogId \|\| bancardQrLogId`, con `.catch(() => {})`. No enlaza líneas extra, Dinelco ni PlugPay. | Código. Base: 28 de 2.360 cobros aprobados (1,2%) sin venta, ₲1.168.819 en 30 días; 16 son QR; 19 tienen un cobro hermano enlazado en el mismo punto dentro de 10 min (coherente con líneas extra, no demostrado) |
| 4 | El servidor no valida que las líneas sumen el total (`sales/service.py` solo hace `db.add(SalePayment(...))`). | Código. Base: 4 de 11.299 ventas solo en Gs con diferencia > ₲50 (2 de más, 2 de menos) |
| 5 | `sale_payments` guarda solo `forma_pago`, `monto`, `moneda`, `fecha`: sin proveedor, terminal, voucher, cuotas ni equivalente en Gs. | Código |
| 6 | El listado de ventas toma la forma de pago de la primera línea hallada, sin orden (`sales/service.py` ~1935). | Código |
| 7 | Cada línea llama al terminal por separado, sin candado. Si falla el paso 2 (`/pos/descuento`) por red tras autorizar en el paso 1, no se registra nada. | Código |
| 8 | Vaciar o cancelar una venta con líneas aprobadas, o cambiar el carrito después de cobrar, deja cobros huérfanos sin aviso. | Código |
| 9 | El monto de PlugPay cae a `mixedQrPyg` si su campo está vacío (posible doble conteo). "Resto" (`getSaldoRestanteParaMetodo`) ignora el efectivo en Gs si no se tocó "Exacto". Las líneas extra de `plugpay` se envían siempre como `PIX`, aun si el sub-método es Parcelado. | Código |

## 3. Alcance

**Dentro:** secciones 4.1 a 4.6.

**Fuera (Etapa 2 o posterior):**
- Lista unificada de líneas y combinaciones de métodos dentro de Bancard (tarjeta + QR).
- Anulación o reversa automática de un cobro aprobado (depende de la API de reversa de Bancard).
- Etiquetar correctamente las líneas extra de `plugpay` Parcelado (hallazgo 9, tercera parte).
- "Otros" y Extra Club con más de una línea.

## 4. Diseño

### 4.1 Un solo guardián de cierre (POS)

- Nuevo archivo `ui-web/src/pages/pos/validarCierre.ts`: función **pura**, sin React.
  - Entrada: `LineaCobro[]` (una por línea, principal o extra) más un contexto (total, saldo Extra Club, datos de Otros, caja abierta).
  - `LineaCobro` = `{ id, metodo, variante, montoPyg, estado: "confirmada" | "en_curso" | "sin_cobrar", cuponManual: boolean }`.
  - Salida: `{ ok: true }` o `{ ok: false, codigo, mensaje }`.
- Un adaptador en `POSPage.tsx` arma `LineaCobro[]` desde el estado actual (principal y extras).
- `handleProcessCheckout` llama a `validarCierre()` **siempre al entrar**. Enter, doble-Enter, F12 y supervisor pasan por lo mismo. El `onClick` del botón conserva solo lo de pantalla (pedir autorización de supervisor).
- Reglas: cada línea no-efectivo confirmada (aprobada por el terminal o con cupón manual); monto > 0; saldo Extra Club; comprobante de transferencia, cheque o vale; suma de montos **confirmados** = total con tolerancia `TOLERANCIA_PAGOS_PYG = 50`.
- Regla extra (hallazgo 2): se rechaza cualquier línea extra de método `qr` o `plugpay_credito` mientras ese método no sea una línea activa contada.
- "Recibido" y "Falta cobrar" cuentan solo líneas confirmadas; las líneas en curso se muestran como "pendiente de confirmar" y no suman.
- Arreglos aritméticos (hallazgo 9): PlugPay deja de caer a `mixedQrPyg`; `getSaldoRestanteParaMetodo` cuenta el efectivo en Gs tipeado.

### 4.2 Líneas de pago enriquecidas y enlace atómico

Migración Alembic (una sentencia por `op.execute`, columnas nullable, `ADD COLUMN IF NOT EXISTS`):

- `sale_payments`: `proveedor VARCHAR(20)`, `terminal_transaction_id UUID` (índice), `referencia VARCHAR(60)`, `cuotas SMALLINT`, `monto_pyg NUMERIC(15,0)`.
- `pos_terminal_transactions`: `requiere_conciliacion BOOLEAN NOT NULL DEFAULT false`, `revisado_por UUID`, `revisado_at TIMESTAMPTZ`.
- `sales`: `pagos_revision VARCHAR(20)`, `pagos_diferencia NUMERIC(15,0)`, `pagos_revisado_por UUID`, `pagos_revisado_at TIMESTAMPTZ`.

Contrato: `SalePaymentInput` gana los campos opcionales `proveedor`, `terminal_transaction_id`, `referencia`, `cuotas`, `monto_pyg`. Un payload viejo sigue siendo válido.

POS: cada línea (principal y extra) envía su `terminal_transaction_id` (`logId`, `bancardTxnLogId`, `bancardQrLogId`, `dinelcoTxnLogId`, etc.), `proveedor`, `referencia` (voucher o autorización), `cuotas` y `monto_pyg`. Para una línea en R$ o US$, `monto` sigue siendo el neto en esa moneda y `monto_pyg` es el equivalente en Gs que cubre la venta (el POS ya lo calcula como `netPygCoveredByBrl`).

Servidor: en `create_sale`, en la **misma transacción**, por cada línea con `terminal_transaction_id`: `UPDATE pos_terminal_transactions SET sale_id = :sale WHERE id = :id AND company_id = :company AND (sale_id IS NULL OR sale_id = :sale)`. Si no afecta ninguna fila (id inexistente, de otra empresa o ya enlazado a otra venta), **el enlace no se aplica, la venta se guarda igual** y queda `pagos_revision = 'enlace_invalido'`. Se elimina la llamada cliente `posTerminalTransactions.update` (~8092) para no tener dos mecanismos.

### 4.3 Validación de suma y marca de revisión (servidor)

Al crear la venta, con las líneas ya cargadas:

1. Si no hay líneas, no se valida (ventas sincronizadas del legacy).
2. `suma = Σ monto_pyg` si viene; si no, `monto` cuando `moneda = 'PYG'`.
3. Si alguna línea es en moneda extranjera y no trae `monto_pyg`: `pagos_revision = 'no_verificable'`.
4. Si `|suma − total| > 50`: `pagos_revision = 'no_cuadran'` y `pagos_diferencia = suma − total` (positivo = de más).
5. La venta **siempre se guarda**. Si hay más de una marca aplicable, prevalece `enlace_invalido`, luego `no_cuadran`, luego `no_verificable`.

El listado de ventas devuelve `forma_pago = 'MIXTO'` cuando hay 2 o más líneas, igual que el detalle.

### 4.4 Panel "Revisión de cobros"

- **Permiso nuevo** `caja:revision_cobros` (módulo `caja`), asignado a Supervisor y Gerente. El Administrador (superadmin) lo tiene siempre. Todos los endpoints exigen `require_permission("caja:revision_cobros")` **en el servidor**.
- `GET /api/v1/caja/revision-cobros?tipo=no_cuadran|huerfanos|multi_proveedor&desde=&hasta=`:
  - `no_cuadran`: ventas con `pagos_revision` no nulo y sin revisar.
  - `huerfanos`: cobros del terminal con `sale_id IS NULL` y `revisado_at IS NULL` que cumplan `(exitosa = true y antigüedad > 15 min)` **o** `requiere_conciliacion = true` (estos últimos aparecen de inmediato, sin esperar los 15 min).
  - `multi_proveedor`: ventas con líneas de 2 o más `proveedor` distintos.
- `POST /api/v1/caja/revision-cobros/{tipo}/{id}/revisar`: fija `revisado_por` y `revisado_at` y registra un evento en `audit_logs` (`accion = 'cobro_revisado'`).
- UI: pestaña "Revisión de cobros" en `CajaPage.tsx`, visible solo con ese permiso.

### 4.5 Protecciones del POS

1. **Candado por terminal** (`ui-web/src/pages/pos/terminalLock.ts`): un mutex por IP de terminal (Bancard o Dinelco). Mientras un cobro está en curso, los demás botones "Cobrar" quedan deshabilitados con "Terminal ocupado". Se libera al terminar, al fallar o por el timeout de 90 s existente. Cubre línea principal y extras.
2. **Paso 2 de Bancard cortado:** si `/pos/descuento` falla por red tras autorizar en `/pos/venta-ux`, se registra el cobro en `pos_terminal_transactions` con `bin`, `nsu`, `exitosa = false` y `requiere_conciliacion = true`. Aparece en `huerfanos`. No se revierte automáticamente.
3. **Cancelar con cobros aprobados:** vaciar o cancelar una venta con líneas aprobadas pide confirmación listando monto, proveedor y voucher de cada una, y avisa que el terminal no devuelve nada solo. Se registra `audit_logs` (`accion = 'cobro_aprobado_cancelado'`, ids en `datos_nuevos`). Pausar una venta no cuenta como cancelar. Si el total del carrito cambia después de cobrar, se muestra un aviso.
4. **QR y Parcelado extra (hallazgo 2, provisorio):** se ocultan los botones "+ Agregar otro QR" (paneles `qr_zimple` y `qr_cloud` de Bancard) y "+ Agregar otro crédito parcelado", con una nota para repartir el cobro en otra línea de tarjeta. Se cierra del todo en la Etapa 2.

### 4.6 Compatibilidad hacia atrás

Todas las columnas nuevas son opcionales y el servidor acepta payloads viejos. Los POS que aún no cargaron la versión nueva siguen vendiendo; sus ventas quedan sin proveedor ni enlace y, si no cuadran, marcadas para revisión.

## 5. Pruebas

- **Servidor** (`api/tests/test_pagos_mixtos.py`, pytest en el `.venv`): suma exacta; de más; de menos; sin líneas; línea en R$ sin `monto_pyg` (`no_verificable`); enlace atómico con id válido; id inexistente, de otra empresa o ya enlazado (`enlace_invalido`, venta guardada); payload viejo sin campos nuevos; `forma_pago = MIXTO` en el listado; permisos del panel (403 sin `caja:revision_cobros`).
- **POS:** `validarCierre.ts` se prueba como función pura con una tabla de casos ejecutable con Node (no hay runner en `ui-web`): doble-Enter con cobro sin aprobar, línea extra `qr` sin método activo, suma de confirmadas distinta del total, línea en curso, tolerancia de ₲50, Extra Club sin saldo. Más `tsc --noEmit`.
- **Sandbox:** todo se prueba primero en el sandbox (esquema paralelo, API en el puerto 8001), con cobros simulados y sin tocar el terminal real.
- **Prueba real:** una venta chica con cobro real en una caja, fuera de horario, al final.

## 6. Despliegue y reversión

Orden: (1) migración y servidor juntos con `deploy-api.sh` (aplica Alembic antes de reiniciar, sin corte); (2) POS con `deploy-ui.sh` (las cajas lo toman al cerrar sesión); (3) panel de revisión.

Reversión: las columnas son opcionales, así que volver atrás el código no rompe datos. Un `alembic downgrade` elimina las columnas nuevas.

## 7. Riesgos

- `POSPage.tsx` tiene ~17.600 líneas y hay otro agente editando en paralelo: los cambios se hacen en pocos puntos, con commits por ruta y sin tocar archivos ajenos.
- `monto_pyg` solo existe en ventas nuevas; las anteriores no se pueden validar retroactivamente.
- La tolerancia de ₲50 permite ventas con pagos de hasta ₲50 de menos; queda registrada en `pagos_diferencia` solo si supera ese umbral.

## 8. Etapa 2 (esbozo)

Reemplazar el modelo actual por una lista unificada de líneas de pago: cada línea con su método y variante, cualquier combinación y cantidad (incluida tarjeta + QR en Bancard), una sola fórmula de "recibido" y un solo punto de armado del payload. Diseño y spec propios.
