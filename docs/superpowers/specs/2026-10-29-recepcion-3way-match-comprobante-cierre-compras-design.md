# Diseño: Acta de Recepción, Cotejo 3-Way Match y Cierre de Compras con Márgenes Comerciales

**Fecha:** 2026-10-29  
**Estado:** Aprobado  
**Autor:** Antigravity & User  
**Contexto:** Extra Supermercado Mayorista (Vertical Supermercado)

---

## 1. Contexto y Problema de Negocio

En el ciclo de compras de Extra Supermercado (Procure-to-Pay / P2P):
1. **Emisión de la Orden de Compra (OC):** El comprador (Juan Gabriel Ruiz) genera la OC negociada con el proveedor (ej. Casa Gonzalito S.R.L.). Este documento es **comercial y externo**, por lo que detalla cantidades y precios pactados de adquisición. Jamás debe exponer los precios de venta al público ni los márgenes del supermercado por confidencialidad ante el proveedor.
2. **Recepción Efectiva en Muelle:** Juan Gabriel recibe físicamente la carga en el muelle de descarga (`/operaciones/deposito/recepcion`), cuenta los bultos reales, registra rechazos o averías y carga lotes/vencimientos.
3. **Asignación de Factura & Cotejo 3-Way Match:** Se vincula la factura fiscal del proveedor (física o XML SIFEN) y el sistema efectúa la conciliación triple:
   $$\text{OC} \iff \text{Recepción en Muelle} \iff \text{Factura}$$

### El Hallazgo / Evidencia Real
Al revisar la documentación física impresa (`OC-20261024-005290`), la gerencia de compras y auditoría anotó a mano:
```text
Cierre de Compras.
FALTA. / Urgente:
* Precio de Venta Unit.
* MARGEN de Precio de Venta.
* Costo Promedio
* Precio de Venta MAYORISTA.
* MARGEN de Precio de Venta MAYORISTA.
```

Hasta el momento, al culminar la recepción o el matching se imprimía la misma OC inicial. Sin embargo, para el **Cierre de Compras y Fijación de Precios en Góndola**, el equipo comercial necesita saber de inmediato si los precios de salón y mayorista siguen siendo rentables ante el nuevo costo ingresado.

Adicionalmente, los proveedores frecuentemente calculan renglones con decimales de IVA o redondeos centesimales, arrojando totales impresos en factura que difieren por pocos guaraníes (ej. ₲ 1 a ₲ 2.000) respecto a la suma directa de enteros. Al asignar la factura debe poder corregirse el monto impreso exacto para que Tesorería pague exactamente lo que indica el papel y no se generen falsas discrepancias.

---

## 2. Requerimientos Funcionales

### R1. Ajuste de Monto Impreso de Factura (Anti-Falsas Discrepancias)
- Permitir ingresar el **Monto Total Impreso en Factura** (`total_factura_impreso`) tanto en la recepción en muelle (`DepositoRecepcionPage.tsx`) como en el modal de asignación de factura en Compras (`PurchasesPage.tsx`).
- Uso estricto de `<CurrencyInput />` en el frontend.
- En el backend (`receive-invoice` y `create-receipt`):
  - Si la diferencia entre el total calculado y el impreso está dentro de la tolerancia de redondeo ($\le ₲ 5.000$), se absorbe como ajuste de redondeo legítimo.
  - Se fija el `total` y `saldo_pendiente` de la factura al valor impreso real.
  - El motor de 3-Way Match registra el estado como **Conforme (Ajuste por Redondeo)** sin bloquear la factura ni emitir Solicitudes de Notas de Crédito (SNC) erróneas.

### R2. Cálculo Canónico de Márgenes sobre Costo Promedio Ponderado (PPP)
- A solicitud expresa del negocio, los márgenes comerciales de fijación en góndola se calculan sobre el **Costo Promedio Ponderado (PPP)** resultante del producto en inventario:
  $$\text{Margen Minorista \%} = \frac{\text{Precio Venta Salón} - \text{Costo Promedio}}{\text{Precio Venta Salón}} \times 100$$
  $$\text{Margen Mayorista \%} = \frac{\text{Precio Venta Mayorista} - \text{Costo Promedio}}{\text{Precio Venta Mayorista}} \times 100$$
- Si el margen es inferior al piso objetivo de seguridad (15%) o negativo, se resalta en rojo/ámbar para advertir que debe actualizarse el precio en salón.

### R3. Generación del Comprobante "Acta de Recepción y Cierre de Compras (Auditoría 3-Way & Margen Comercial)"
- Nuevo reporte PDF oficial mediante ReportLab (`generate_purchase_3way_receipt_pdf` en `api/src/purchases/pdf_reports.py`).
- Formato A4 profesional, cumpliendo las reglas corporativas:
  - Sin el sufijo `Gs.` (moneda PYG tácita).
  - Zona horaria `America/Asuncion` para fechas y horas de emisión y recepción.
  - Encabezado con datos de:
    - **Orden de Compra:** N° OC, fecha, comprador (Juan Gabriel Ruiz), condición de pago.
    - **Recepción en Muelle:** N° REC / AUTO-REC, depósito receptor, fecha/hora recepción física, receptor.
    - **Factura:** N° Comprobante proveedor, RUC, Timbrado, Total impreso.
  - Resumen de Cotejo 3-Way:
    - Total OC vs Total Recibido vs Total Facturado.
    - Estado: **CONFORME 100% (Habilitada a Pago)** o **DISCREPANCIA (Retenida por SNC N°...)**.
  - Tabla Maestra de Renglones:
    - `#` | `Cód. Interno` | `Cód. Barra` | `Descripción` | `Cant. Recibida` | `Costo Factura Unit.` | `Costo Promedio (PPP)` | `PVP Salón` | `Margen %` | `PVP Mayorista` | `Margen Mayorista %`.
  - Firmas Tripartitas:
    - Elaborado / Recepción Muelle (Juan Gabriel Ruiz).
    - Verificación / Auditoría 3-Way Match.
    - Cierre de Compras & Precios (Gerencia de Compras / Comercial).

---

## 3. Arquitectura y Endpoints

### Backend
1. **Endpoint de Reporte PDF:**
   - `GET /v1/purchase-orders/{order_id}/3way-receipt-pdf`
   - Opcionalmente parametrizable por `receipt_id` o `invoice_id`.
   - Consulta:
     - Orden de Compra (`PurchaseOrder` y sus ítems).
     - Recepción física asociada (`PurchaseReceipt` y sus ítems).
     - Factura de proveedor asociada (`SupplierInvoice` y sus ítems).
     - Productos (`Product`): `costo_promedio`, `ultimo_costo`, `precio_venta`, `precio_mayorista`.
     - Resultado 3-Way Match (`matching_service.perform_3way_match`).
2. **Actualización de `receive_invoice_for_order` (`api/src/purchases/router.py`):**
   - Recibir `total_factura_impreso: Optional[Decimal] = Form(None)`.
   - Ajustar el total de la factura si se suministra, registrando en notas el ajuste de redondeo.
3. **Actualización de `DepositoRecepcionPage.tsx` y `create_receipt`:**
   - Enviar `total_factura_impreso` desde el muelle cuando Juan Gabriel tiene la factura física a la vista.

### Frontend
1. **Muelle de Recepción (`ui-web/src/pages/operations/DepositoRecepcionPage.tsx`):**
   - Campo para ingresar el monto total de la factura física con `<CurrencyInput />`.
   - Botón en pantalla de éxito: *"Imprimir Acta de Recepción y Cierre 3-Way"*.
2. **Compras & Auditoría (`ui-web/src/pages/purchases/PurchasesPage.tsx`):**
   - Modal de recibir factura: campo `total_factura_impreso`.
   - Modal de resultado 3-Way Match: botón *"Descargar Comprobante de Cierre y Márgenes (PDF)"*.
   - Acciones de la tabla de órdenes: acceso directo a descargar el comprobante de cierre cuando la orden ya cuente con recepción y factura.

---

## 4. Criterios de Éxito y Verificación
1. Al cargar una factura con ligeras discrepancias de redondeo decimal (ej. ₲ 1.500), el operador puede ajustar el monto al impreso en papel y el 3-Way Match lo aprueba como Conforme sin trabar Cuentas por Pagar.
2. Al descargar el comprobante PDF de Cierre de Compras, aparecen las 5 columnas solicitadas a mano:
   - `Precio de Venta Unit.`
   - `MARGEN de Precio de Venta` (calculado sobre PPP)
   - `Costo Promedio (PPP)`
   - `Precio de Venta MAYORISTA`
   - `MARGEN de Precio de Venta MAYORISTA` (calculado sobre PPP)
3. Formato visual impecable, sin caracteres `Gs.` aislados, con fecha en `America/Asuncion`, firmas tripartitas y semáforo de matching.
