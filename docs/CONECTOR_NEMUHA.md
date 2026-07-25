# Conector Ñemuha (ConceptoComercial/FlexPDV) → InteliMarket

Cliente piloto: Supermercado, vertical Supermercados, Fase 1 (Administración, Finanzas, Contabilidad, Stock, Tesorería + Gerente Financiero IA).

## 1. Qué es realmente el sistema legacy

Vendido localmente como "Flextech Ñemuha", el producto real es **ConceptoComercial** (origen brasileño, también distribuido como "FlexPDV"). Backend Java + Tomcat, frontend Adobe AIR/Flex, base **MySQL 5.6** (sin soporte de seguridad desde feb-2021). ~260 tablas, todas en portugués, organizadas por prefijo de módulo.

## 2. Conectividad (ya operativa)

- Servidor físico del cliente (`servidor-extra`, Windows Server 2025, Tailscale `100.76.95.42`) corre Ñemuha en producción.
- VM `extra-conector` (Ubuntu 26.04 LTS en Hyper-V, Tailscale `100.83.91.76`) es el puente — desde ahí se lee la base, nunca directo desde InteliMarket a la red del cliente.
- Usuario MySQL `intelimarket_ro`@`%`: permisos `SELECT, SHOW VIEW, TRIGGER, LOCK TABLES` **solo** sobre `comercial_extra_py`. Verificado que no puede escribir.
- Backup completo (`--single-transaction`) ya tomado antes de cualquier lectura masiva.

## 3. Mapeo de datos por área

### Administración
| Tabla legacy | Filas | Contenido | Destino |
|---|---|---|---|
| `bs_pessoa` | 4.266 | Tabla universal de terceros: clientes, proveedores **y empleados** (tiene salario, IPS, fecha de contratación). Campos clave: `TP_PESSOA`, `RUC`, `NACIONALIDAD` (enum PRY/BRA/ARG/URY/BOL — confirma comercio fronterizo), `TP_OPERACAO` (B2C/B2B/B2F/B2G), `VL_LIMITE_CREDITO` | Clientes/proveedores → modelos de InteliMarket. Empleados → **no se migra a InteliMarket**, se empuja a **SueldOK** vía `POST /api/employees` (contrato ya definido en `docs/INTEGRATIONS.md`) |
| `filial` | 1 fila hoy | Sucursales | Cliente confirmó que **va a abrir más sucursales** — diseñar todo con `ID_FILIAL` como clave de partición real desde el día uno, aunque hoy solo exista una |
| `empresa` | — | Datos de la empresa (RUC, razón social) | Cabecera del tenant en InteliMarket |

**Pendiente de confirmar:** valores reales de `TP_PESSOA` (¿qué código es cliente, proveedor, empleado?) — no asumir, consultar `SELECT DISTINCT TP_PESSOA, COUNT(*) FROM bs_pessoa GROUP BY TP_PESSOA` antes de escribir el transformer.

### Finanzas
| Tabla legacy | Filas | Destino InteliMarket |
|---|---|---|
| `fin_conta_pagar` + `fin_parcela_conta_pagar` + `fin_pagamento` | 5.4K / 5.3K / 5.4K | `financial.SupplierInvoice` / `SupplierInvoicePayment` (AP + aging) |
| `fin_conta_receber` + `fin_parcela_conta_receber` + `fin_recebimento` | 5.3K / 5.6K / 110K | `accounts_receivable` (AR + aging) |
| `fin_movimento_caixa` | 10.6K | Libro de caja unificado — fuente principal de flujo de caja diario, enlaza a cobros/pagos/ventas/retiros/gastos |
| `fin_movimento_caixa_chica` | 175K | `petty_cash` |
| `fin_saldo_fornecedor` | 32 | Saldo por proveedor, cruzar contra AP calculado |

**Hallazgos que simplifican el trabajo:**
- `DIAS_VENCIDOS` ya viene calculado en ambas tablas de parcelas — no recalcular aging desde cero, solo homologar el criterio.
- `fin_conta_receber.SITUACAO` es `varbinary(20)` (¡no `varchar` como en `fin_conta_pagar`!) — decodificar explícitamente al leer, no asumir texto plano.

### Tesorería
| Tabla legacy | Filas | Destino |
|---|---|---|
| `bc_banco` + `bc_conta_banco` | 4 / 4 | `financial.BankAccount` |
| `bc_operacao_banco` | 7.749 | `financial.BankTransaction` — tabla principal para conciliación |
| `bc_pagamento_com_cheque` + `bc_item_pagamento_com_cheque` | 305 / 812 | Pagos con cheque (frecuente en Paraguay) |
| `bc_transferencia_conta` | 98 | Transferencias entre cuentas propias |

### Ventas (soporte para Finanzas, no Fase 1 completa)
| Tabla legacy | Filas | Uso |
|---|---|---|
| `ven_venda` | 105K | Encabezado de venta. **Ya trae `VL_TOTAL_LUCRO` y `VL_TOTAL_CUSTO` calculados** → no hace falta tocar `ven_item_venda` (594K filas, 145MB) para el dashboard financiero inicial. Multi-moneda: `VL_DOLAR`/`VL_REAL`/`VL_GUARANI` por venta — **Guaraní confirmado como moneda base de reporte** |

### Fiscal (SIFEN) — mapea contra el módulo que ya existe en InteliMarket
| Tabla legacy | Filas | Destino |
|---|---|---|
| `con_nota_faturada` | 109.5K | Libro de facturación fiscal paraguaya real: `IVA_CINCO`, `IVA_DEZ`, `ID_TIMBRADO`, `NR_FATURA`, tipo `VENTA/NOTA CREDITO/NOTA REMISSAO` → cruza directo con `sifen` y `reports.get_fiscal_book`/`get_fiscal_summary` |
| `con_timbrado`, `con_secuencia_fatura` | 40 / 15 | Timbrados vigentes y numeración |

### Contabilidad — **no se construye dentro de InteliMarket**
El cliente confirmó: **no lleva contabilidad formal hoy**, y ese es justamente uno de los dolores centrales de la venta. No hay plan de cuentas ni libro diario que migrar en Ñemuha (`con_*` es "comprobantes fiscales", no contabilidad).

La arquitectura correcta, según `docs/INTEGRATIONS.md` (ya definida, no hay que inventar nada): InteliMarket **emite eventos** (`invoice.issued`, `purchase.received`, `payment.recorded`, `period.closed`) hacia **InteliCont**, que es quien genera los asientos contables. El conector de Ñemuha entonces no llena `integrated_finance` con asientos históricos — transforma `con_nota_faturada` + `fin_conta_pagar`/`fin_pagamento` hacia esos eventos, a partir de la fecha de arranque en adelante (no hay necesidad ni valor en reconstruir asientos retroactivos de un sistema que nunca los tuvo).

**Decidido:** InteliCont **no se activa todavía** para este tenant. El conector, por ahora, solo aterriza los datos transformados en InteliMarket (facturas, pagos, cobros) sin emitir los webhooks de `docs/INTEGRATIONS.md`. La emisión hacia InteliCont queda como una fase posterior — el transformer debe diseñarse para que activarla después sea agregar el emisor de eventos, no rehacer el mapeo de datos.

### Stock — fuera de alcance de esta fase
`est_*` (54 tablas, incluye `est_movimentacao_estoque` con 637K filas / 230MB, la tabla más pesada de todo el sistema) queda para cuando se aborde el módulo de Stock en serio. No sincronizar en la Fase 1.

## 4. Estrategia de sincronización propuesta

Volúmenes modestos para todo lo de Finanzas/Tesorería/Fiscal (la tabla más grande relevante es `con_nota_faturada` con 109K filas) — no hace falta CDC ni replicación en tiempo real para arrancar. Propuesta simple:

- Job nocturno (o cada pocas horas) corriendo en `extra-conector`, leyendo con `intelimarket_ro` por ventana de fecha (`DT_*` de cada tabla) desde el último sync exitoso.
- Aterriza en una zona de staging en InteliMarket; un paso de transformación aplica el mapeo de esta tabla y llama a los servicios ya existentes (`financial.create_invoice`, `accounts_receivable.apply_payment_to_receivable`, etc.) en vez de insertar filas crudas directo a producción.
- Reevaluar frecuencia real (¿nocturno alcanza, o el Gerente Financiero necesita datos más frescos?) una vez que el diagnóstico esté corriendo con datos reales.

## 5. Indicadores iniciales para el Gerente Financiero IA

Con lo ya mapeado, el primer diagnóstico puede calcular sin trabajo adicional:
- **Aging de AP/AR** — directo desde `DIAS_VENCIDOS` en las tablas de parcelas.
- **Flujo de caja** — desde `fin_movimento_caixa` + `bc_operacao_banco`.
- **Margen bruto por venta** — directo desde `ven_venda.VL_TOTAL_LUCRO`/`VL_TOTAL_CUSTO`, sin tocar el detalle de items.
- **Estado de cuentas bancarias** — desde `bc_conta_banco` + `bc_operacao_banco`.

## 6. Decisiones ya tomadas (no volver a preguntar)

- Moneda base de reporte: **Guaraní**.
- Diseño multi-sucursal desde el día uno (`ID_FILIAL` como partición real), aunque hoy solo exista 1 fila en `filial` — el cliente confirmó planes de expansión.
- Empleados de `bs_pessoa` van a SueldOK, no a un módulo de RRHH dentro de InteliMarket.
- Contabilidad se resuelve vía eventos a InteliCont, no con un motor contable propio dentro de InteliMarket — pero **la activación de InteliCont queda para después**; por ahora el conector solo aterriza datos en InteliMarket.
