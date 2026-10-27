# Piloto viajes + cajas de cobrador: mapeo legacy -> InteliMarket (Casa Gonzalito)

Código: `scripts/migracion_casa_gonzalito/sync_incremental.py` (`--once=viajes`, también corre en el cron horario)
y `comparar_rendiciones.py`. Destino: `trips`/`trip_*` (`api/src/viajes`) y `route_sessions`/`route_liquidations`
(`api/src/ruta_caja`). Medido sobre la copia local `columbia` (60 días hasta 2026-07-22).

## Cómo se forma ARENDIR (cajas 267575, 267540, 267526 y estadística de 60 días)

- `cajas.ARENDIR` = suma de **todas** las facturas de la carga (`fac_ventas.ID_CAJA`), contado y crédito: coincide en
  1729 de 1729 cajas con ARENDIR>0. Solo coincide con el subtotal contado (`IDTIPO_VENTA=1`) en 954 (hay 1620 facturas crédito en cajas).
- 267575: ARENDIR 2.545.086 = 2 facturas. Cobros por `ID_CAJAS`: 50.344 (**no** entra en ARENDIR). 267540: 34.567.714 = 23 facturas,
  sin `cajaautoriza`. 267526: 14.615.381 = 40 facturas.
- La rendición real está en `cajaautoriza` (una fila por caja, la pone Tesorería): 267575 TOTAL 2.605.334 = OTROEGRESO 2.600.382 + OTROINGRESO 4.952;
  267526 TOTAL 2.518.500 = OTROEGRESO. Cobros, devoluciones (NC) y gastos **no** se restan en ARENDIR; ARENDIR es "lo cargado", no "lo cobrado".
- 743 cajas tienen ARENDIR=0: cajas de cobranza/depósito (ej. cobrador 1027, `TRANSFERENCIA CHEQUE`), sin carga.
- `IDCOBRADOR=0` (89 cajas, Gs. 1.009 M, todas abiertas): cargas sin cobrador asignado; no se importan.

## Mapeo

| Legacy | IM | Nota |
|---|---|---|
| `camiones` (28) | `trip_vehicles` | id `uuid5(camion:ID)`; `patente`=CHAPA en mayúsculas; vacía/`0`/`.` -> `LEG-<id>`; repetida (OAL 707) -> sufijo `-<id>`. `max_weight_kg`=CAPACIAD, que mezcla toneladas y kg: <=40 se multiplica por 1000 (heurística), 0 = sin dato |
| `cajas` + `cajaautoriza` + `cobros*` | `route_sessions` | **una por (cobrador, fecha)** (UNIQUE de IM): varias cajas se consolidan. `cobrador_id` = `users.id` si `funcionarios.CI_NUMERO` = `users.email`, si no `uuid5(func:<cod>)` (no se crean usuarios). `created_by` = IDFUNCIONARIO resuelto igual. `estado` cerrada si todas CIERE=1; `fondo_inicial`=0; `route_id` NULL |
| `cajaautoriza` (EFECTIVO, PAGARES, DESCUENTOS, AUTOR) | `route_liquidations` (1 por sesión con autorización) | `efectivo_declarado`=EFECTIVO, `pagares_declarado`=PAGARES, `descuentos_autorizados`=DESCUENTOS, `estado`=autorizada si AUTOR=1 en todas; `efectivo_esperado`=suma ARENDIR (valor legacy, no cálculo de IM); `total_cobrado_ar`=cobros+cheques+pagarés por ID_CAJAS; `nc_aplicadas`=0 |
| `cobroschequesrecibidos`, `cobrospagares` por ID_CAJAS | `route_liquidation_items` | tipo `cheque` (NOCHEQUE) / `pagare` (NUMEDOCU); sin banco ni vencimiento (no se leen del legacy) |
| `rescamion` + `fac_resumen` | `trips` (1 por cobrador+fecha, UNIQUE de IM) | `patente` por IDCAMION de **rescamion** (en `fac_resumen` viene en 0, verificado: 0 de 1750 cargas lo traen); `km_*` = KILOMSALIDA/LLEGADA (ver dudas); `peso_total_kg`=SUM(PESO); `estado` completado/en_ruta; `route_session_id`; `despachante_id`=IDFUNCIONARIO de la caja. Cajas sin rescamion (90) no son viaje |
| `fac_ventas.ID_CAJA` | `trip_stops` (1 por factura) + `sales_orders` `facturado` (origen `legacy_viaje`, `sale_id`) | `trip_stops.sales_order_id` es NOT NULL y IM no tenía pedido por factura; items desde `sale_items`. `orden_visita` = orden de IDFACVENTAS (el legacy no guarda orden de visita). Parada `entregado` si el viaje cerró (supuesto: sin dato de rechazos) |
| `item_resumen` | sin destino | los ítems salen de la factura |
| `cajas.AUTORIZA/VIAJE/CIERREV/DEPOSITO/SNRO`, `cajaautoriza` ANTICIPO/OTROEGRESO/OTROINGRESO, `rescamion` ayudante | sin destino | ANTICIPO/OTROEGRESO/OTROINGRESO ya viven en `route_cash_settlements` (sync previo `cajas`) |

Idempotencia: ids `uuid5` (`rsesion`, `rliq`, `rliqitem`, `trip`, `tstop`, `so_fac`, `soi`, `tsi`). Filas existentes en estado terminal
(sesión no `abierta`, viaje no `en_ruta`, liquidación existente) o con (cobrador, fecha) ya ocupado por IM no se tocan.
Ventana: 60 días (`VIAJES_DESDE` la fija) por bisección de PK sobre `cajas`; luego watermark `viajes` y relectura de los últimos 600 IDCAJA.
Consultas al legacy: solo rangos sobre PK/índices (`IDCAJA`, `ID_CAJA`, `ID_CAJAS`), verificadas con EXPLAIN (`range`, índice).

## Lo que no calza (reportado, no corregido)

1. `ruta_caja/service.py` consulta `receivable_payments.monto` y `.tipo`; la tabla real tiene `monto_total` y `forma_pago`: `close_session` y
   `get_route_session_detail` fallan con `column "monto" does not exist`. Además `get_route_session_detail` filtra `>= fecha AND < fecha` (rango vacío).
2. El concepto difiere: IM calcula efectivo cobrado en AR por cobrador/día; ARENDIR legacy es el total cargado.
3. IM permite 1 sesión y 1 viaje por cobrador+día; el legacy tiene varias cajas (y a veces varios camiones: 88 días) por cobrador+día.
4. `sync_ventas` marca crédito con `MODOPAGO in (1,2)`, pero esos valores no existen (hay 0, 153, 303, 803, 991, 992): las 16.218 facturas de viajes
   quedaron `contado` en IM; el legacy las distingue con `IDTIPO_VENTA` (2 = crédito: 1.620 facturas, Gs. 5.152 M en cajas).
5. `KILOMLLEGADA - KILOMSALIDA` = 1 en 1716 de 1731 salidas: parecen un contador de viajes, no un odómetro.
