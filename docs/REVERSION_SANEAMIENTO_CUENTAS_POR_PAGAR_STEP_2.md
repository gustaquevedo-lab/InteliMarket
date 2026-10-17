# PROTOCOLO DE REVERSIÓN Y AUDITORÍA: SANEAMIENTO CUENTAS POR PAGAR (ETAPA 2)

> **Fecha de Ejecución:** 17 de Octubre de 2026  
> **Servidor:** VM Producción Supermercado (`intellihouse@100.83.91.76` / `192.168.0.10`)  
> **Base de Datos:** PostgreSQL `intelimarket` (Esquema `public`)  
> **Tablas Modificadas:** `public.supplier_invoices`, `public.supplier_credit_notes`, `public.suppliers`, `public.products`  

---

## 1. Resumen de la Operación Realizada

Se resolvió la anomalía de acumulación masiva de **"Proveedor Desconocido"** en la pantalla de Cuentas por Pagar generada por la ingesta IMAP de SIFEN:

1. **Reasignación de Facturas (47 facturas por Gs. 165.310.689):**
   - Decodificadas mediante el CDC oficial de SIFEN.
   - Reasociadas a sus proveedores reales (Casa Gonzalito, Papa Ivar, Popai, Super Mix, Upisa, etc.).
   - Se registró a **SVM GROUP SOCIEDAD ANONIMA** (RUC `80130116-5`) para facturas de ese contribuyente.
2. **Conversión de Notas de Crédito Electrónicas (49 NCs por Gs. 30.070.904):**
   - Estaban erróneamente registradas como facturas por pagar (deuda artificial).
   - Se migraron a `public.supplier_credit_notes` con saldo disponible a favor del supermercado y se eliminaron de facturas.
3. **Depuración de Notas de Remisión (1 documento por Gs. 0):**
   - Se removió de facturas por pagar por no ser documento fiscal de deuda.
4. **Purga de Proveedores Huérfanos:**
   - Se eliminaron los 280 registros basura `Proveedor Desconocido` con RUC `N/A`.
   - Se preservó la integridad referencial en `public.products`.
5. **Blindaje de Código:**
   - Se parcheó `sifen_xml_parser.py` para soportar búsqueda recursiva e inspección de `gDatGralOpe/gEmis` y decodificación de CDC como respaldo.
   - Se actualizó `imap_service.py` para desviar Notas de Crédito (`iTiDE = 5`) a `SupplierCreditNote` y omitir Remisiones (`iTiDE = 7`).

---

## 2. Dónde están los Respaldos (Auditoría)

Existen dos tablas de auditoría completas en PostgreSQL:
1. `public.audit_saneamiento_supplier_invoices_20261017`:
   - Guarda cada `invoice_id`, `old_supplier_id`, `new_supplier_id`, `action`, `cdc`, `total` y la fila previa completa en formato JSONB.
2. `public.audit_saneamiento_pruned_suppliers_20261017`:
   - Guarda los proveedores huérfanos eliminados con sus metadatos y notas originales.

---

## 3. Cómo Revertir si fuese necesario

Para deshacer esta operación y volver al estado previo exacto:

### Simulación previa (Dry-Run):
```bash
ssh intellihouse@100.83.91.76 "cd /home/intellihouse/intelimarket && .venv/bin/python3 api/revert_saneamiento_cuentas_por_pagar_step_2.py --dry-run"
```

### Reversión Definitiva:
```bash
ssh intellihouse@100.83.91.76 "cd /home/intellihouse/intelimarket && .venv/bin/python3 api/revert_saneamiento_cuentas_por_pagar_step_2.py --commit"
```
