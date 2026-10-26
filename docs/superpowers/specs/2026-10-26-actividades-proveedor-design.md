# Motor de actividades de proveedor — diseño

Vertical: Distribuidora (Casa Gonzalito). Aprobado por el usuario por partes el 26-oct-2026. Modo ponytail: lo mínimo que cumple.

## Por qué

En el sistema viejo las "actividades" son promociones pagadas por el proveedor (ej. "MARILAN 5% desde 20 unidades", "cada 10 cajas 1 gratis") con presupuesto mensual. Medición sobre la copia local (22-ene a 22-jul-2026): 103.517 líneas con actividad (27% de las líneas), ₲2.419 M de descuento (5,3% de la facturación) y 26.948 unidades bonificadas. El pedido de InteliMarket hoy guarda descuento 0: sin este motor, al ser InteliMarket el único facturador los clientes pagarían ~5% más.

Datos del legacy (`columbia`): `actividad` (cabecera, `TIPOACT`, `CICLO`, `PRESUPUESTO`, `ATTRIB`, `FECINI/FECFIN`, `CODICUENT/CODICTA`), `item_act` (`DC=1` = tramo con `CANTVEND` meta y `CANTBONI` % o unidades; `DC=0` = productos del alcance), `item_ventas.ACTIV` = `A`+IDCLIENTE+actividad.ID o fecha-hora+vendedor+actividad.ID. Tipos usados: 2 (escala→%) y 1 (cada N, M gratis). Tipos 3 y 4 sin ventas en 6 meses. `ATTRIB=8` (87%) = indicador de meta en cajas en interfaz de usuario.
*Nota de verificación Task 7:* En `item_act`, `CANTVEND` ya viene persistido en unidades finales (ej. 40 para 'DSD 1CX' de wafer con 40 u/caja; 6 para 'DSD 1CFS' con 6 u/caja; 20 para sachet de 18 u/caja). Por lo tanto `desde_cantidad` se mapea directo sin multiplicar por `CANT_CAJA`.

## Decisiones del usuario

1. InteliMarket manda al celular las reglas (escalas y requisitos); la app las aplica sola. El preventista no edita descuentos.
2. Al recibir el pedido el servidor audita; si algo no cumple, el pedido queda **retenido para aprobación**.
3. Alcance **elegible** por actividad: productos, proveedor o división.
4. Carga: **sync del legacy hasta el corte**; después, pantalla en InteliMarket.
5. Rendición al proveedor: **informe + cuenta a cobrar + asiento**.
6. Las dos reglas (escala y bonificación) y la valorización de lo bonificado **elegible por actividad** (precio de lista o costo promedio).

## 1. Datos

Tablas nuevas (DDL idempotente en `scripts/migrate.py`, no alembic):

- `actividades`: `id` uuid, `company_id`, `legacy_id` int único por empresa (null si se cargó en InteliMarket), `nombre`, `supplier_id`, `ciclo` char(6) AAAAMM, `vigente_desde`/`vigente_hasta` date, `tipo` (`escala`|`bonificacion`), `alcance` (`productos`|`proveedor`|`division`), `alcance_ids` uuid[] (productos o divisiones; vacío si alcance=proveedor), `presupuesto` numeric(15,0), `consumido` numeric(15,0) default 0, `valoriza_bonificacion` (`lista`|`costo`) default `lista`, `cuenta_contable` text, `activa` bool, timestamps.
- `actividad_tramos`: `id`, `actividad_id`, `desde_cantidad` numeric (en **unidades**), `porcentaje` numeric(5,2) (escala), `cada` numeric + `bonifica` numeric + `producto_bonificado_id` uuid null = mismo producto (bonificación), `tope` numeric null (máximo bonificadas por pedido).
- `actividad_aplicaciones`: `id`, `company_id`, `actividad_id`, `sale_id`, `sale_item_id`, `descuento_monto` numeric(15,0), `unidades_bonificadas` numeric, `valor` numeric(15,0) (lo que consume del presupuesto), `created_at`. Índices por `actividad_id` y `sale_id`.
- `actividad_rendiciones`: `id`, `company_id`, `supplier_id`, `ciclo`, `monto` numeric(15,0), `cobrado` numeric(15,0) default 0, `estado` (`pendiente`|`parcial`|`cobrada`), `asiento_numero`, `created_by`, `created_at`. Único (`company_id`,`supplier_id`,`ciclo`).

Columnas nuevas: `sale_items.actividad_id` uuid, `products.unidades_por_caja` numeric (del legacy `CANT_CAJA`), `products.division_id` uuid (de `item_division`, solo si se usa alcance división), `supplier_credit_notes.rendicion_id` uuid.

Fuera: tipos 3 y 4; combinar actividades en una línea; filtro por tipo de cliente (`TIPOCLIE` vale `*` en las vigentes).

## 2. Reglas de cálculo

Orden por pedido: precio de la lista del cliente (entero con IVA) → actividades → IVA de la línea final al más próximo (`iva_incluido`).

- **Escala**: base = suma de unidades de todos los productos del alcance en el pedido. Tramo = el mayor `desde_cantidad` ≤ base. Descuento **unitario** = `gs(precio × % / 100)` (hacia arriba, igual que el legacy); `descuento_monto` de la línea = unitario × cantidad.
  - Ej. "MARILAN 5% desde 20": 12 × ₲16.884 y 8 × ₲5.200 → unitarios ₲845 y ₲260 → descuento de línea ₲10.140 y ₲2.080. Con 19 unidades: nada.
- **Bonificación**: `bonificadas = floor(base / cada) × bonifica`, con `tope`. Se agrega una línea del producto bonificado (por defecto el mismo) a precio ₲0.
  - Ej. "cada 10, 1 gratis, tope 5": 34 → 3; 80 → 5.
- **Varias actividades sobre la misma línea**: gana la de mayor descuento para esa línea; empate → la que vence antes. No se suman.
- **Valor que consume del presupuesto**: escala = `descuento_monto`; bonificación = unidades × (precio de lista | `costo_unitario` del producto) según `valoriza_bonificacion`, en Gs enteros hacia arriba.
- Metas en cajas del legacy: el sync las guarda ya multiplicadas por `CANT_CAJA` del producto del tramo. El motor solo cuenta unidades.

Implementación: **una función pura** `evaluar(pedido, actividades) -> resultado` en Python (`api/src/actividades/engine.py`) y su espejo en TypeScript (`inteliforce/lib/actividades.ts`). Un archivo de casos compartido `api/tests/fixtures/actividades_casos.json` lo prueban los dos.

## 3. Celular (Inteliforce)

- `GET /inteliforce/actividades`: vigentes hoy, con tramos y `producto_ids` ya resueltos (proveedor/división → productos) y `saldo` = presupuesto − consumido.
- Se cachea en SQLite como el catálogo (`saveActividades`/`getActividades`) y funciona sin señal.
- Al cambiar cantidades, la app corre `evaluar` y muestra precio final, nombre de la actividad, líneas bonificadas a ₲0 y el aviso "faltan N unidades para X%". No hay edición manual de descuentos.
- El pedido manda por línea `actividad_id`, `descuento_unitario` y `bonificada` (bool).

Fuera: elegir entre actividades, push de actividades nuevas, pantalla de catálogo de promociones.

## 4. Auditoría y retención

- En `POST /inteliforce/orders`, antes de crear la venta: el servidor corre `evaluar` con sus actividades y saldos y compara línea por línea (actividad, descuento unitario, bonificadas). Saldo insuficiente = diferencia.
- Igual → sigue. Cualquier diferencia → venta con `estado = pendiente_aprobacion` y un pedido en la **cola de aprobaciones existente** (`credit_approval_requests`) con `motivo = 'actividades'` y `detalle` (jsonb: por línea, lo del celular vs lo del servidor y el motivo). Si además hay motivo de crédito, es un solo pedido con ambos motivos.
- Una firma, con permiso `aprobar_actividades`: **aprobar tal cual** (se respeta lo que vio el cliente; si excede el presupuesto queda registrado), **corregir** (se aplica lo del servidor) o **rechazar**.
- El presupuesto se consume **al confirmar la venta** (creada sin retención o aprobada): se graban `actividad_aplicaciones` y se suma a `consumido` con `SELECT ... FOR UPDATE` sobre la actividad. `cancel_sale` borra las aplicaciones y resta.

Fuera: tolerancias, retener solo diferencias en contra, notificaciones.

## 5. Rendición

- Informe Excel por proveedor y ciclo: por actividad (clientes, facturas, unidades, descuento ₲, bonificadas y su valor, presupuesto, consumido, %) y detalle por factura.
- "Cerrar rendición" (manual, por proveedor y ciclo): crea `actividad_rendiciones` (`pendiente`) = cuenta a cobrar al proveedor, y el asiento vía `integrated_finance.service.post_accounting_entry`: Debe "Reintegros a cobrar a proveedores" / Haber `cuenta_contable` de la actividad (recupero). Mismo `asiento_numero` para las dos líneas.
- Cobro: al cargar la nota de crédito del proveedor (`supplier_credit_notes`) se elige la rendición (`rendicion_id`); cancela la cuenta a cobrar (no es ingreso nuevo) y su saldo se aplica a facturas como hoy. Rendición → `parcial` o `cobrada`.

Fuera: PDF, envío por correo, períodos no mensuales, cobro en efectivo.

## Puntos a confirmar al implementar

- `credit_approval_requests` admite `credit_account_id` nulo y nuevas columnas `motivo`/`detalle` sin romper la pantalla de crédito.
- El plan de cuentas de Casa Gonzalito tiene "Reintegros a cobrar a proveedores"; si no, crearla.
- Meta en cajas = `ATTRIB` bit 3 (8): validar con 3 actividades reales antes de cerrar el sync.
- `division_id` del producto: solo si hay actividades vigentes con alcance división; si no, ese alcance queda para después del corte.
