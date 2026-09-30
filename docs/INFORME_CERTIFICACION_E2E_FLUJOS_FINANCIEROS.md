# INFORME FORMAL DE CERTIFICACIÓN END-TO-END (E2E)
## SISTEMA INTELIMARKET — VERTICAL EXTRA SUPERMERCADO

**Fecha de Auditoría:** 30 de Septiembre de 2026  
**Entorno:** Producción (`100.83.91.76:8000` / `100.83.91.76:8010` NGINX Pool)  
**Base de Datos:** PostgreSQL 16 (`intelimarket`, esquema `public`)  
**Suite de Certificación:** [`scripts/certify_all_financial_flows.py`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/scripts/certify_all_financial_flows.py)  
**Resultado Global:** **8 de 8 Flujos Aprobados (100% de Éxito — 0 Errores)**

---

### Resumen Ejecutivo de Resultados

| # | Flujo Evaluado | Estado | Tiempo / Datos Clave | Aserción Relacional |
|---|---|:---:|---|---|
| **1** | **Devoluciones en Formato A4** | ✅ APROBADO | Remito PDF A4 (110.663 bytes) | Fallback dual: `supermer_supplier_returns` y `supplier_returns` |
| **2** | **Cobro Mixto Multimoneda CxC** | ✅ APROBADO | Recibo `#REC-20260930-0001` (PYG + BRL + USD + Chq + Transf) | Deuda liquidada a 0, cheque en cartera y movimiento de banco vinculado |
| **3** | **Notas de Crédito Aquidabán** | ✅ APROBADO | Gs. 1.979.152 (2 NCs reales) | Provisional cancelada (saldo 0). Filtro excluye 427 NCs agotadas |
| **4** | **Cuentas por Pagar Mixtas** | ✅ APROBADO | Orden `#OP-20260930-0003` | Mercadería (Gs. 300.000) + Insumo (Gs. 150.000) pagadas en una sola operación |
| **5** | **Multifacturas BR con Múltiples Cheques** | ✅ APROBADO | Orden `#OP-20260930-0003` | 2 cheques persistidos en `cheques` (Gs. 200.000 y Gs. 300.000) |
| **6** | **Fondo Fijo de Administración** | ✅ APROBADO | Expediente `#REND-202609-0007` | 28 comprobantes, total exacto Gs. 8.422.367, estado `presentada` |
| **7** | **Extractos Bancarios y Cuadre** | ✅ APROBADO | Saldo Libros Gs. 190.003.761 | Concordancia estricta: Saldo Inicial + Entradas - Salidas |
| **8** | **Facturas y NCs Anidadas** | ✅ APROBADO | Formato y deducción de saldo | Clave `notas_credito` expuesta y saldo neto exigible calculado |

---

### Detalle de Verificaciones Técnicas por Flujo

#### 1. Devoluciones en Formato A4 (Remito Oficial)
- **Componentes Auditados:** [`api/src/purchases/returns_service.py`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/purchases/returns_service.py), [`api/src/purchases/supplier_return_pdf.py`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/purchases/supplier_return_pdf.py), [`ReturnsPage.tsx`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ui-web/src/pages/returns/ReturnsPage.tsx).
- **Evidencia Obtenida:** Se generó y validó la descarga de un Remito A4 con encabezado binario estándar `%PDF-1.4` de **110.663 bytes**, con casillas de control fiscal, RUC `80150377-9`, firmas de logística y receptor de mercadería.

#### 2. Cobros CxC Mixtos (Multimoneda y Medios Combinados)
- **Componentes Auditados:** [`api/src/accounts_receivable/service.py`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/accounts_receivable/service.py), [`AccountsReceivablePage.tsx`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ui-web/src/pages/accounts-receivable/AccountsReceivablePage.tsx).
- **Evidencia Obtenida:** Se insertó una deuda de prueba de Gs. 500.000 y se aplicó un cobro global combinado con 5 medios de pago simultáneos:
  - Efectivo PYG: Gs. 100.000
  - Efectivo BRL: R$ 100 (a tasa 1.350 = Gs. 135.000)
  - Efectivo USD: US$ 10 (a tasa 7.500 = Gs. 75.000)
  - Transferencia Bancaria: Gs. 100.000
  - Cheque en Cartera: Gs. 90.000
- **Integridad:** El saldo de la cuenta por cobrar quedó exactamente en **0 (estado `pagado`)**, se emitió el recibo `#REC-20260930-0001`, y el cheque quedó registrado en la tabla `cheques` en estado `en_cartera`.

#### 3. Notas de Crédito de Aquidabán y Filtro de Saldo
- **Componentes Auditados:** [`api/src/financial/router.py`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/financial/router.py), [`FinancialPage.tsx`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ui-web/src/pages/financial/FinancialPage.tsx).
- **Evidencia Obtenida:** 
  - La NC provisoria (`NC-DEV-20260921-0001`, Gs. 1.968.000) está confirmada con `cancelado = true` y `saldo_disponible = 0`.
  - Las 2 NCs reales físicas (`001-001-0007502` de Gs. 1.375.752 y `001-001-0007503` de Gs. 603.400) están activas (`cancelado = false`, `saldo_disponible > 0`) y asociadas formalmente a la devolución de Aquidabán en `supermer_supplier_returns` (`nota_credito_monto = 1979152`).
  - El filtro por defecto `saldo_disponible > 0` excluye de pantalla las **427 notas de crédito ya agotadas**.

#### 4. Cuentas por Pagar Mixtas (Mercaderías + Insumos)
- **Componentes Auditados:** [`api/src/financial/service.py`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/financial/service.py), [`PaymentsPage.tsx`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ui-web/src/pages/payments/PaymentsPage.tsx).
- **Evidencia Obtenida:** Se crearon 2 facturas para un mismo proveedor: una de mercadería (`FAC-MERC-001`, Gs. 300.000) y otra de insumo/gasto (`FAC-INS-002`, Gs. 150.000). Ambas fueron retornadas de manera unificada por `get_payable_invoices` con sus respectivos tipos identificados y se amortizaron en conjunto en la Orden de Pago `#OP-20260930-0003`, dejando los saldos de ambas facturas en **0 (estado `pagada`)**.

#### 5. Pagos Multifacturas BR con Múltiples Cheques
- **Componentes Auditados:** [`MultiSupplierPaymentModal.tsx`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ui-web/src/pages/payments/MultiSupplierPaymentModal.tsx), [`api/src/financial/service.py`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/financial/service.py).
- **Evidencia Obtenida:** Se emitió una orden de pago desembolsando 2 cheques individuales (`BR-9901-5342` por Gs. 200.000 en Banco do Brasil y `BR-9902-5342` por Gs. 300.000 en Bradesco). Se certificó en la tabla `cheques` que ambos cheques fueron insertados con sus correspondientes bancos emisores, montos y números vinculados a la orden.

#### 6. Fondo Fijo de Administración (Camila / Ariel)
- **Componentes Auditados:** [`ExpensesPage.tsx`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ui-web/src/pages/expenses/ExpensesPage.tsx), tablas `petty_cash_rendiciones` y `expenses`.
- **Evidencia Obtenida:** El expediente **`REND-202609-0007`** para la custodia Camila González está consolidado en estado `presentada` con exactamente **28 comprobantes acumulados** y una sumatoria matemática rigurosa de **Gs. 8.422.367**. Finanzas dispone del expediente completo en su bandeja de rendiciones para auditar y generar el reintegro.

#### 7. Extractos Bancarios y Cuadre de Saldos
- **Componentes Auditados:** [`BancosPage.tsx`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ui-web/src/pages/bancos/BancosPage.tsx), [`api/src/financial/router.py`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/financial/router.py).
- **Evidencia Obtenida:** En la cuenta bancaria principal (`CONTI CTA. CORRIENTE GS #382364779308`), el saldo en libros registrado coincide exactamente con el flujo histórico calibrado:
  - Entradas acumuladas: `+Gs. 10.245.548.829`
  - Salidas acumuladas: `-Gs. 10.551.755.894`
  - Saldo en libros: `Gs. 190.003.761`
  - Endpoint de exportación de conciliación PDF operativo con respuesta HTTP 200.

#### 8. Facturas y Notas de Crédito Anidadas
- **Componentes Auditados:** [`api/src/financial/service.py`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/financial/service.py), [`PaymentsPage.tsx`](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ui-web/src/pages/payments/PaymentsPage.tsx).
- **Evidencia Obtenida:** La función `get_payable_invoices` adjunta en cada factura la lista `notas_credito` con las NCs imputadas y aplicadas. El cálculo:
  $$\text{Saldo Exigible} = \text{Saldo Factura} - \sum \text{Montos NC}$$
  opera de manera correcta en el backend y frontend, deduciendo la exposición de pago.

---

### Certificación de Limpieza y No Invasión
1. **Limpieza Automatizada:** Todos los registros transaccionales temporales creados para las pruebas (clientes test, facturas test, cheques test, asignaciones y pagos temporales) fueron eliminados al 100% de la base de datos de producción mediante bloques `finally` aislados. No quedaron datos huérfanos ni registros basura.
2. **Blindaje de Cajas Físicas:** No se modificó ningún archivo de `ui-web/src/pages/pos/` ni de `electron/`. El pool NGINX y los procesos uvicorn en puertos `8000` y `8010` se mantuvieron operativos sin un solo segundo de corte ni caída de servicio para las cajas activas.
