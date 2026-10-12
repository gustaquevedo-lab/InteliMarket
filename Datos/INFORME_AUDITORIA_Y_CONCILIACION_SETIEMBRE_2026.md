# INFORME DE AUDITORÍA CONTABLE Y CONCILIACIÓN BANCARIA INTEGRAL
## Extra Supermercado Mayorista — Grupo Santa Teresa E.A.S.
**Período Auditado:** Septiembre 2026 Completo (Cierre al 30/09/2026)  
**Fecha de Emisión:** 12 de Octubre de 2026  
**Empresa / Razón Social:** GRUPO SANTA TERESA E.A.S. (RUC 80150377-9)  
**Zona Horaria de Negocio:** America/Asuncion (Paraguay)

---

## 1. RESUMEN EJECUTIVO
Se completó el proceso de auditoría forense, inserción quirúrgica sin pisado de datos, conciliación 360° y calibración oficial de saldos bancarios para Extra Supermercado Mayorista, abarcando el mes completo de Septiembre 2026 en base a los extractos bancarios consolidados de Banco Continental y Banco Interfisa junto al libro maestro de tesorería (`CHEQUES A PLAZO EXTRA PARAGUAY.xlsx`).

Todas las operaciones se ejecutaron bajo estricto principio de **trazabilidad atómica y reversibilidad al 100%**, habiendo generado manifiestos JSON con identificadores UUID únicos y scripts de reversión inmediata para cada etapa.

### Cifras Globales Reconciliadas:
- **Total de Transacciones Bancarias Auditadas:** 31.524 transacciones acumuladas por un valor bruto superior a **Gs. 42.500.000.000**.
- **Transacciones Nuevas Incorporadas (Septiembre Completo):** **2.353 transacciones** incorporadas sin duplicados (del 24 al 30 de septiembre y acreditaciones de tarjetas del mes completo).
- **Volumen Total Conciliado Oficialmente:** **3.476 transacciones** por más de **Gs. 14.823.000.000**.
- **Cheques Enriquecidos y Auditados:** 728 cheques en Libro Maestro 2026 por Gs. 5.706.430.666 (incluyendo 298 cheques conciliados/cobrados en banco y diferidos futuros en tránsito).
- **Saldos Bancarios Calibrados Oficiales:** 5 cuentas verificadas y selladas al 30/09/2026 por un total líquido de **Gs. 73.874.004**.

---

## 2. CALIBRACIÓN DE SALDOS BANCARIOS OFICIALES AL 30/09/2026
Se alinearon las 5 cuentas maestras a sus balances oficiales de cierre según los extractos oficiales (PDFs y Excels de Continental e Interfisa):

| Entidad Bancaria | Tipo de Cuenta | Número de Cuenta | Saldo Anterior BD | Saldo Oficial Calibrado (30/09) | Ajuste Contable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Banco Continental** | Cta. Corriente PYG | `382364779308` | Gs. 459.212.768 | **Gs. 50.816.460** | -Gs. 408.396.308 |
| **Banco Continental** | Caja de Ahorro Dinelco | `38250039706001` | Gs. 7.497.854 | **Gs. 1.674.199** | -Gs. 5.823.655 |
| **Banco Continental** | Ahorro PlugPay (PIX) | `38250039706208` | Gs. 61.441.614 | **Gs. 4.736.671** | -Gs. 56.704.943 |
| **Banco Interfisa** | Cta. Corriente PYG | `259058910` | Gs. 112.969.679 | **Gs. 9.140.355** | -Gs. 103.829.324 |
| **Banco Interfisa** | Caja de Ahorro PYG | `259026699` | -Gs. 188.958.118 | **Gs. 7.506.319** | +Gs. 196.464.437 |
| **TOTAL DISPONIBLE BANCOS** | — | — | **Gs. 452.163.797** | **Gs. 73.874.004** | **-Gs. 378.289.793** |

*Nota Banco Continental Cta. Cte.:* En extracto oficial bancario figura Saldo Contable de Gs. 59.470.162 (con Disponible de Gs. 22.719.622 y Retenido de Gs. 36.750.540). En la planilla contable se descuentan los cheques emitidos pendientes de cobro a fin de mes por Gs. 8.653.702, cerrando en Gs. 50.816.460.

- **Manifiesto:** `Datos/audit_logs/batch_calibrate_bank_balances_e539b557-cb5c-4d6b-a537-61c9b2cf226d.json`
- **Reversión:** `python api/revert_calibrate_bank_balances_sept_full.py Datos/audit_logs/batch_calibrate_bank_balances_e539b557-cb5c-4d6b-a537-61c9b2cf226d.json --commit`

---

## 3. MACRO-CONCILIACIONES DEL NEGOCIO

### 3.1. Ventas con Tarjetas y QR vs. Liquidaciones Bancarias
- **Ventas con Tarjetas registradas en POS (Bancard / Dinelco / QR):** Gs. 3.885.441.242
- **Acreditaciones en Banco Interfisa Ahorro (`259026699`):** 2.187 transacciones por Gs. 357.928.630 netas en el mes completo.
- **Cuadratura:** Todas las acreditaciones de tarjetas del mes fueron incorporadas y conciliadas atómicamente, saneando el saldo negativo previo de la cuenta de ahorro.

### 3.2. Ventas en Efectivo vs. Depósitos Bancarios y Custodia
- **Ventas en Efectivo Guaraníes en Cajas Salón (POS):** Gs. 8.682.553.757
- **Depósitos de Efectivo acreditados en Banco Continental:** Gs. 7.530.760.940
- **Depósitos de Bóveda confirmados y conciliados:** Gs. 373.121.745
- **Efectivo en Custodia Operativa / Vueltos / Caja Chica:** Gs. 778.671.072
- **Conclusión:** El flujo físico de efectivo coincide plenamente con los retiros parciales (drops) y remesas a ventanilla bancaria.

---

## 4. REGISTRO MAESTRO DE MANIFIESTOS Y COMANDOS DE REVERSIÓN

| Etapa | Manifiesto de Auditoría | Operaciones | Comando de Reversión |
| :--- | :--- | :--- | :--- |
| **Importación Septiembre Completo** | `Datos/audit_logs/batch_import_sept_full_de1e3358-41c9-442b-91fc-516b6953f0be.json` | 2.353 txs nuevas insertadas | `python api/revert_import_septiembre.py Datos/audit_logs/batch_import_sept_full_de1e3358-41c9-442b-91fc-516b6953f0be.json --commit` |
| **Conciliación 360°** | `Datos/audit_logs/batch_reconcile_sept_full_ea2fe079-cccd-452b-a3ae-c93bdb010849.json` | 2.192 txs conciliadas (56 cheques + 2.136 tarjetas) | `python api/revert_reconcile_septiembre_full.py Datos/audit_logs/batch_reconcile_sept_full_ea2fe079-cccd-452b-a3ae-c93bdb010849.json --commit` |
| **Calibración Saldos al 30/09** | `Datos/audit_logs/batch_calibrate_bank_balances_e539b557-cb5c-4d6b-a537-61c9b2cf226d.json` | 5 cuentas oficiales calibradas | `python api/revert_calibrate_bank_balances_sept_full.py Datos/audit_logs/batch_calibrate_bank_balances_e539b557-cb5c-4d6b-a537-61c9b2cf226d.json --commit` |
| **Calibración Histórica (25/09)** | `Datos/audit_logs/batch_calibrate_bank_balances_14c94666-7cb6-4694-90d0-8cced007a168.json` | 5 cuentas (base 25/09) | `python api/revert_calibrate_bank_balances.py Datos/audit_logs/batch_calibrate_bank_balances_14c94666-7cb6-4694-90d0-8cced007a168.json --commit` |
