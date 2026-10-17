# Especificación Técnica y de Diseño: Sistema Integral de Conciliación Bancaria y Extractos

**Proyecto:** Extra Supermercado Mayorista (InteliMarket)  
**Módulo:** Gestión Financiera / Bancos y Tesorería  
**Fecha:** 17 de Octubre de 2026  
**Razón Social:** GRUPO SANTA TERESA E.A.S. (RUC 80150377-9)  
**Estado:** Propuesta de Diseño lista para Aprobación  

---

## 1. Contexto y Objetivos del Rediseño

El subsistema bancario actual presentaba tres debilidades críticas:
1. **Reporte PDF de Conciliación Bancaria Deficiente:**
   - Formato Portrait (vertical) estrecho que provocaba desbordes de texto.
   - Ausencia de saldo progresivo y cifras confusas sin distinción clara entre débito y crédito.
   - Falta del cuadro formal de conciliación bancaria contable (Saldo Bancario vs. Partidas en Tránsito vs. Saldo en Libros).
2. **Limitación en la Ingesta de Extractos Bancarios:**
   - La API solo aceptaba archivos Excel (`.xlsx`), obligando al usuario a convertir manualmente los extractos PDF oficiales de Banco Continental y Banco Interfisa.
3. **Flujo de Auto-Conciliación Opaco:**
   - Criterio de búsqueda excesivamente rígido (fecha $\le 2$ días y tolerancia 0.1%), sin cruce inteligente de cheques diferidos con fecha de vencimiento ni trazabilidad visual para el usuario.

**Objetivo Central:** Construir un flujo unificado, intuitivo y robusto donde el usuario arrastra su extracto (PDF o Excel), el sistema reconoce automáticamente el banco, empareja las operaciones con un asistente visual transparente, y genera un documento PDF oficial A4 Landscape impecable para auditoría.

---

## 2. Arquitectura de la Solución

```mermaid
flowchart TD
    A[Extracto Bancario Oficial<br/>PDF / Excel Continental o Interfisa] --> B[Dropzone Universal de Carga]
    B --> C[Motor Detector de Banco & Formato]
    C -->|PDF Continental| D1[Parser PDF Continental<br/>Tabla extract_tables / pdfplumber]
    C -->|PDF Interfisa| D2[Parser PDF Interfisa<br/>Regex & Coordenadas SIPAP]
    C -->|Excel| D3[Parser Excel Existente]
    D1 & D2 & D3 --> E[Vista Previa de Transacciones Bancarias]
    E -->|Confirmar Ingesta| F[(public.bank_transactions)]
    F --> G[Motor Inteligente de Auto-Conciliación]
    G --> H1[Coincidencia Verde 100%:<br/>Cheque N° exacto o Ref. SIPAP]
    G --> H2[Coincidencia Amarilla Sugerida:<br/>Monto coincidente en ventana de fecha]
    H1 & H2 --> I[Modal Asistente Visual con Semáforo]
    I -->|1-Clic Conciliar Lote| J[Actualización Contable:<br/>Cheques pasan a 'cobrado', facturas canceladas]
    J --> K[Generador PDF Conciliación Bancaria A4 Landscape]
```

---

## 3. Especificación Detallada por Componente

### Componente 1: Parser e Ingesta Universal de Extractos PDF

#### Bancos y formatos soportados:
1. **Banco Continental (Cuenta Corriente y Cajas de Ahorro):**
   - Estructura: Encabezado corporativo Continental, resumen de saldos y tabla con columnas `Dia`, `Hora`, `Movimiento`, `Descripción`, `Debe`, `Haber`, `Saldo`.
   - Extracción con `pdfplumber`: Se extraen las celdas directamente de la grilla vectorial.
   - Normalización de importes paraguayos: Separador de miles por punto (`.`) y centavos por coma (`,`).
   - Detección de número de cheque: Extrae automáticamente el número si en `Descripción` dice `CHEQUE DEP.N/B <num>` o `CHEQUE PAGADO <num>`.
2. **Banco Interfisa (Cuenta Corriente y Ahorro POS):**
   - Estructura: Formato Interfisa con columnas `Fch/Oper/Valor`, `Comprobante`, `Descripción`, `Débito`, `Crédito`, `Saldo`.
   - Extracción: Se analiza el bloque de comprobante (código numérico de operación SIPAP / boleta) y descripción.
3. **Endpoint Universal:**
   - `POST /api/financial/banks/{account_id}/import-statement`
   - Recibe archivo multipart (`.pdf`, `.xlsx`, `.xls`).
   - Retorna: Detección de banco, número de cuenta, período detectado, cantidad de débitos, cantidad de créditos, y preview de los primeros 100 movimientos antes de persistir.

---

### Componente 2: Motor Inteligente de Auto-Conciliación

El motor busca contrapartes en el sistema clasificando la certeza en dos niveles:

1. **Nivel Verde (Alta Confianza - 100% Seguro):**
   - **Cheques emitidos:** Si el movimiento bancario es un débito y en su descripción figura un número de cheque que coincide exactamente con un cheque emitido en estado `entregado` o `pendiente` de esa cuenta bancaria y el monto coincide $\rightarrow$ **Match 100%**.
   - **Transferencias / Facturas:** Si la referencia bancaria coincide exactamente con la referencia de una Orden de Pago o comprobante SIPAP y el monto es idéntico.
   - **Acción:** Preseleccionados con checkbox activo para conciliar en lote en un solo clic.
2. **Nivel Amarillo (Sugerencia para Revisión Manual):**
   - Misma suma monetaria exacta dentro de una ventana de fecha de $\pm 5$ días, pero sin número de comprobante explícito (ej: cobros POS agrupados, transferencias sin referencia en extracto).
   - **Acción:** Aparece en un panel inferior desplegable con botón individual de *"Aceptar Sugerencia"* o *"Descartar"*.
3. **Efectos Automáticos de la Conciliación:**
   - El cheque vinculado se marca como `cobrado`, con fecha efectiva de cobro en banco y registro inmutable en `public.cheque_historial`.
   - La transacción bancaria pasa a `conciliado = true` con `fecha_conciliacion = now()`.

---

### Componente 3: Rediseño Integral del PDF de Conciliación Bancaria (Modalidad Dual)

Se implementarán dos variantes de PDF seleccionables por el usuario según la necesidad operativa:

1. **Modalidad 1: Detallada (A4 Landscape — Horizontal):**
   - **Propósito:** Auditoría exhaustiva y punteo minucioso.
   - **Dimensiones:** $297 \times 210\,\text{mm}$ (área útil $275\,\text{mm}$).
   - **Contenido:**
     - Cuadro formal de conciliación bancaria contable superior (Saldo Banco + Depósitos en tránsito - Cheques en tránsito = Saldo en Libros).
     - **Grilla completa de movimientos:** `Fecha`, `Hora/Operación`, `Concepto Bancario`, `Referencia / Cheque`, `Contraparte Contable`, `Débito (Gs.)`, `Crédito (Gs.)`, `Saldo Progresivo (Gs.)`.
     - Anexo de Partidas en Tránsito desglosadas (cheques diferidos pendientes con proveedor y vencimiento).
     - Anexo de movimientos bancarios pendientes de identificar.

2. **Modalidad 2: Resumida Ejecutiva (A4 Portrait — Vertical):**
   - **Propósito:** Presentación ejecutiva a gerencia, directorio y archivo rápido de 1 sola página.
   - **Dimensiones:** $210 \times 297\,\text{mm}$ (área útil $180\,\text{mm}$).
   - **Contenido:**
     - Encabezado institucional de Extra Supermercado.
     - **Cuadro Resumen de Conciliación:** Saldo Bancario, Totales en Tránsito y Saldo en Libros con badge de cuadre.
     - **Solo Partidas Pendientes de Conciliar:** Resumen de cheques diferidos en tránsito y depósitos pendientes (sin listar los cientos de movimientos ya conciliados que abultan páginas innecesarias).
     - Firmas de Tesorería y Contabilidad.

- **Selector en Interfaz Web (`BancosPage.tsx`):**
  - El botón *"PDF Conciliación"* dispondrá de un menú desplegable (o modal ágil) con dos opciones claras:
    * 📄 **"Extracto Detallado (Horizontal)"** $\rightarrow$ `formato=landscape`
    * 📑 **"Resumen Ejecutivo (Vertical)"** $\rightarrow$ `formato=portrait`

---

## 4. Plan de Archivos a Modificar / Crear

| Archivo | Acción | Descripción |
|---|---|---|
| `api/src/financial/pdf_parser.py` | Crear | Motor de parsing y extracción estructurada para extractos PDF de Continental e Interfisa con `pdfplumber`. |
| `api/src/financial/pdf_reports.py` | Modificar | Reestructuración de `generate_reconciliation_pdf()` a Landscape A4 con cuadro contable y saldo progresivo. |
| `api/src/financial/service.py` | Modificar | Enriquecer `get_reconciliation_report()` para computar saldo progresivo, saldo en libros y cheques diferidos en tránsito; actualizar motor de auto-conciliación con tolerancia inteligente para cheques diferidos. |
| `api/src/financial/router.py` | Modificar | Nuevo endpoint unificado `POST /banks/{account_id}/import-statement` (soporte PDF y XLSX). |
| `ui-web/src/pages/bancos/BancosPage.tsx` | Modificar | Dropzone universal para subir PDF/Excel, nuevo modal con semáforo Verde/Amarillo de auto-conciliación y botón de descarga del PDF renovado. |

---

## 5. Criterios de Aceptación y Verificación

1. **Prueba de Ingesta PDF:** Se procesarán los archivos reales en `Datos/` (`CONTINENTAL CTE SEPTIEMBRE 2026.pdf` e `INTERFISA CTE AGOSTO 2026.pdf`) verificando que se extraigan el 100% de las filas, débitos, créditos y números de cheque sin pérdida de datos.
2. **Prueba de Auto-Conciliación:** Se verificará que los débitos bancarios que contengan números de cheques de la cartera coincidente pasen automáticamente a la categoría Verde y actualicen el cheque a `cobrado`.
3. **Prueba Visual del PDF:** Generación del PDF de conciliación bancaria verificando cero desbordes, números formateados en Guaraníes con punto de miles y la presencia del cuadro de conciliación formal.
