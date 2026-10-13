# Gestión de Crédito y Cobranzas — Distribuidora Design Spec

## Contexto

La distribuidora opera con cobradores de campo que recorren rutas diarias, cobran documentos pendientes de clientes, y al final del día rinden lo cobrado. Los instrumentos de cobro son: efectivo, cheques diferidos, y pagarés. Las notas de crédito nacen de devoluciones en entrega (faltante, vencimiento, "no es su pedido"). Todo esto debe integrar con la infraestructura de rutas ya construida (sub-proyecto #1).

## Diagnóstico del estado actual

### Lo que ya existe en InteliMarket (y está bien)

| Módulo | Estado |
|---|---|
| `accounts_receivable` — Documentos, pago, aging, scoring, extracto PDF | Completo. Adaptar filtros de ruta/cobrador |
| `credit_accounts` — Límites, mora, dunning WhatsApp, anticipos, write-off, aprobación sobre-límite | Completo. Adaptar tipo C/D/L/N del legacy |
| `AccountsReceivablePage.tsx` — 6 tabs, pago global, empresas vinculadas | Completo. Extender con cobrador y ruta |
| `CreditAccountsPage.tsx` — 5 tabs | Completo. Sin cambios de fondo |

### Lo que falta para distribuidora

1. **Pagarés** — 37 pendientes (Gs 472 M) en legacy; cero soporte en InteliMarket
2. **Notas de crédito de entrega** — 292 K registros legacy con conceptos propios: "No Es Su Pedido", "Faltante En Depósito", "sin dinero", "Corto Vencimiento y/o Averiado"
3. **Cobros mixtos** — un cobro puede incluir efectivo + cheques + aplicar nota de crédito, como en `cobroschequesrecibidos`
4. **Gestión de cobrador** — asignación de cobrador a documento/ruta, historial de gestión por cobrador
5. **Vista de cobranzas por ruta** — panel de cobranza diaria filtrado por ruta = herramienta de trabajo del cobrador
6. **Cheque devuelto** — marcar cheque como devuelto, re-abrir deuda, registrar protesto

---

## Arquitectura

### Nuevos modelos

#### `DeliveryNote` (notas de crédito de entrega)
```
tabla: delivery_notes
- id: UUID PK
- company_id: UUID FK
- customer_id: UUID FK customers
- sale_id: UUID FK sales (nullable — puede no haber factura aún)
- numero_nota: VARCHAR(30) — NUMNOTACRED del legacy
- numero_factura_ref: VARCHAR(30) — NUMFAC que origina la NC
- fecha: DATE
- monto: NUMERIC(18,0)
- concepto: ENUM('no_es_su_pedido','faltante_deposito','sin_dinero','vencimiento_averia','otro')
- descripcion: TEXT nullable
- vendedor_id: UUID FK users nullable
- cobrador_id: UUID FK users nullable
- estado: ENUM('pendiente','aplicada','anulada') DEFAULT 'pendiente'
- aplicada_en_cobro_id: UUID FK receivable_payments nullable
- created_by: UUID FK users
- created_at: TIMESTAMPTZ
```

#### `Pagare` (pagarés)
```
tabla: pagares
- id: UUID PK
- company_id: UUID FK
- customer_id: UUID FK customers
- receivable_account_id: UUID FK accounts_receivable nullable — el documento que origina el pagaré
- numero_pagare: VARCHAR(30) — número correlativo
- monto_original: NUMERIC(18,0)
- saldo_pendiente: NUMERIC(18,0)
- fecha_emision: DATE
- fecha_vencimiento: DATE
- motivo: TEXT nullable
- estado: ENUM('vigente','pagado','protestado','anulado') DEFAULT 'vigente'
- cobrador_id: UUID FK users nullable
- created_by: UUID FK users
- created_at: TIMESTAMPTZ
```

#### `PagarePayment` (cobros de pagarés)
```
tabla: pagare_payments
- id: UUID PK
- pagare_id: UUID FK pagares
- cobro_id: UUID FK receivable_payments — el cobro que lo cancela/parcial
- monto_aplicado: NUMERIC(18,0)
- fecha: DATE
- created_by: UUID FK users
- created_at: TIMESTAMPTZ
```

### Extensiones a modelos existentes

#### `accounts_receivable` (tabla: accounts_receivable)
Agregar columnas:
- `cobrador_id UUID nullable FK users` — cobrador asignado
- `route_id UUID nullable FK routes` — ruta a la que pertenece el cliente en este doc

#### `receivable_payments` (tabla: receivable_payments)
Agregar columnas:
- `cobrador_id UUID nullable FK users`
- `nota_credito_id UUID nullable FK delivery_notes` — nota aplicada en este cobro
- `nota_credito_monto NUMERIC(18,0) nullable` — monto de NC aplicado

#### `cheques_recibidos` (tabla: cheques_recibidos — ya existe)
Agregar columnas:
- `cobro_id UUID nullable FK receivable_payments` — el cobro en que se recibió este cheque
- `cobrador_id UUID nullable FK users`

---

## Flujos de negocio

### 1. Registro de cobro mixto
El cobrador llega al cliente y cobra parcial o total. El cobro puede ser:
- Solo efectivo
- Efectivo + cheque diferido
- Efectivo + nota de crédito aplicada
- Pagaré (el cobrador emite un pagaré)
- Cheque + nota de crédito

**Modal de cobro (extensión del actual):**
- Campo: Cobrador (selector)
- Método 1: Efectivo — monto
- Método 2: Cheque — banco, número, monto, vencimiento
- Método 3: Aplicar NC — dropdown con NCs pendientes del cliente, muestra concepto y monto
- Método 4: Pagaré — número, monto, vencimiento
- Resumen: Total métodos debe = monto cobrado. Si queda saldo: documento queda pendiente.

### 2. Pagaré

**Emisión:**
- Desde la ficha de un documento pendiente → botón "Emitir Pagaré"
- Campos: número de pagaré, monto, vencimiento, motivo
- Estado inicial: `vigente`
- El documento original sigue pendiente hasta que el pagaré se cobre

**Cobro de pagaré:**
- Tab "Pagarés" en AR page
- Registrar cobro: monto parcial o total, forma de pago
- Actualiza `saldo_pendiente`, si llega a 0 → estado `pagado`
- Crea un `PagarePayment` linking al cobro

**Protesto:**
- Botón "Protestar" en pagaré vigente vencido
- Requiere nota (motivo protesto)
- Estado → `protestado`
- Re-abre el documento original como pendiente

### 3. Nota de crédito de entrega

**Creación:**
- Tab dedicado en AR page o botón desde documento
- Campos: número de nota, número de factura origen, fecha, monto, concepto (dropdown con 5 opciones del legacy), descripción libre, vendedor, cobrador
- Estado: `pendiente`

**Aplicación:**
- Se aplica al momento del cobro (ver flujo cobro mixto)
- O se puede aplicar manualmente: "Aplicar NC" desde la NC pendiente → elige documento al que acreditar
- Estado → `aplicada`

**Anulación:**
- Solo admin. Libera el documento asociado.

### 4. Vista de cobranzas por ruta

Panel en AR page (tab nuevo "Por Ruta"):
- Selector: Fecha + Ruta
- Lista de clientes en esa ruta con documentos pendientes ese día
- Por cliente: nombre, saldo total, documentos vencidos, teléfono
- Acciones inline: Registrar cobro, Ver documentos, Llamar (tel: link)
- Al final: botón "Pre-liquidación" → genera resumen de lo cobrado en la ruta para el cobrador (input para sub-proyecto #3)

### 5. Cheque devuelto

Desde ChequesPage o desde el cobro:
- Seleccionar cheque depositado → "Marcar como Devuelto"
- Registrar: fecha devolución, motivo (ej. "sin fondos")
- Efecto: el cobro original se revierte, el documento de AR vuelve a estado `pendiente` con saldo = monto del cheque devuelto
- Notificación dunning opcional

---

## Frontend — Cambios en páginas existentes

### `AccountsReceivablePage.tsx`

**Tab nuevo: "Pagarés"**
- Tabla: cliente, número pagaré, monto original, saldo, vencimiento, estado
- Filtros: estado (vigente/protestado/vencido hoy), cobrador, ruta
- Acciones: Ver, Cobrar, Protestar
- Modal "Emitir Pagaré" accesible desde documento pendiente

**Tab nuevo: "Notas de Crédito"**
- Tabla: número NC, cliente, factura origen, monto, concepto, estado, fecha
- Filtros: concepto, estado, vendedor
- Acciones: Ver, Aplicar, Anular
- Botón "Nueva NC"

**Tab nuevo: "Por Ruta"** (vista cobranza diaria)
- Selector fecha + ruta
- Cards por cliente: saldo, docs vencidos, último cobro, teléfono
- Acción inline: Cobrar

**Tab existente "Documentos" — agregar:**
- Columna "Cobrador"
- Filtro por cobrador y por ruta
- En modal de cobro: métodos mixtos + aplicar NC + emitir pagaré

### `CreditAccountsPage.tsx`

**Tab existente "Cuentas" — agregar:**
- Campo visual "Tipo" (C/D/L/N) mapeado desde legacy (o seleccionable al crear)
- Campo "División" o ruta preferente del cliente

---

## Migraciones Alembic

`20261013110000` — tablas delivery_notes, pagares, pagare_payments; columnas cobrador_id/route_id en accounts_receivable; cobrador_id/nota_credito_id en receivable_payments; cobro_id/cobrador_id en cheques_recibidos (si no existe la tabla, crearla vacía con esquema base).

---

## Endpoints nuevos

### Pagarés
```
POST   /api/v1/distribuidora/pagares                          — emitir
GET    /api/v1/distribuidora/pagares?company_id=&status=&cobrador_id=
GET    /api/v1/distribuidora/pagares/{id}
POST   /api/v1/distribuidora/pagares/{id}/pay                 — cobrar parcial/total
POST   /api/v1/distribuidora/pagares/{id}/protest             — protestar
```

### Notas de Crédito
```
POST   /api/v1/distribuidora/delivery-notes
GET    /api/v1/distribuidora/delivery-notes?company_id=&estado=&concepto=&customer_id=
GET    /api/v1/distribuidora/delivery-notes/{id}
POST   /api/v1/distribuidora/delivery-notes/{id}/apply        — aplicar a cobro/documento
POST   /api/v1/distribuidora/delivery-notes/{id}/cancel       — anular
```

### Vista por ruta
```
GET    /api/v1/distribuidora/cobranzas/by-route?company_id=&route_id=&fecha=
```
Retorna lista de clientes en ruta con saldo pendiente, documentos, último cobro.

### Cheque devuelto
```
POST   /api/v1/receivables/cheques/{cheque_id}/bounce         — marcar devuelto
```

---

## Consideraciones de diseño

### Tipos de crédito (TIPO del legacy)
- **C** — Crédito normal (cta. cte.)
- **D** — Débito (pago anticipado/contado con días)
- **L** — Lista de precios especial
- **N** — No tiene crédito / solo contado

Mapear en `CreditAccount.tipo: ENUM('C','D','L','N')` con default `'C'`.

### Monedas
El legacy usa solo Gs (guaraníes). InteliMarket soporta múltiples monedas. Para distribuidora: forzar PYG en todos los nuevos endpoints.

### Cobrador vs. Vendedor
En el legacy los mismos funcionarios pueden ser vendedores y cobradores. En InteliMarket hay un campo `role` en users. Se permite que cualquier usuario con acceso al módulo sea cobrador; la asignación es por conveniencia operativa, no es un rol de acceso.

### Pre-liquidación vs. Liquidación
La "vista por ruta" genera el borrador de liquidación diaria. La liquidación final (con reconciliación de bóveda) es sub-proyecto #3. El spec de sub-proyecto #3 consumirá el endpoint `by-route` de este spec.

---

## No incluido en este sub-proyecto

- Liquidaciones de Cobrador (sub-proyecto #3): depende de este módulo pero es entidad propia
- Integración bancaria automática (conciliación de cheques depositados): fuera de alcance
- Factura electrónica de NC: las NCs de entrega son internas; si requieren SIFEN es trabajo separado
