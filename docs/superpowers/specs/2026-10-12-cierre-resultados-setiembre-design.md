# Especificación de Diseño: Reporte Integral de Cierre de Resultados — Septiembre 2026

**Empresa / Razón Social:** GRUPO SANTA TERESA E.A.S. (RUC 80150377-9)  
**Nombre Comercial:** Extra Supermercado Mayorista  
**Período de Cierre:** 01/09/2026 al 30/09/2026  
**Fecha de Emisión:** 12 de Octubre de 2026  
**Zona Horaria de Negocio:** America/Asuncion (Paraguay)  
**Moneda Principal:** Guaraníes (PYG / Gs.)  
**Estado:** Propuesta Aprobada — En transición a Plan de Implementación

---

## 1. Resumen Ejecutivo y Objetivos

### 1.1. Propósito
Proveer un subsistema de cierre mensual integral para la presentación de los resultados económicos y financieros de Septiembre 2026 en Extra Supermercado Mayorista. El sistema consolida todos los flujos de ingresos por ventas y recaudación, el Costo de Mercaderías Vendidas (CMV), la nómina devengada integral del personal (salarios base, horas extras, cargas sociales de IPS patronal 16.5%, provisión de aguinaldo y beneficios directos), la clasificación exhaustiva de los egresos operativos (OPEX) en 6 categorías estándar de retail, y la conciliación contra los saldos bancarios calibrados oficiales al 30/09/2026 (Gs. 73.874.004).

### 1.2. Entregables Clave
1. **Módulo Web Interactivo (`ui-web`):** Tablero gerencial con KPIs, estado de resultados en cascada con filas colapsables/expandibles y navegación directa a los comprobantes de cada magnitud.
2. **Exportador de Libro Excel (.xlsx) Multi-Hoja:** Archivo generado con `openpyxl` estructurado con una **Hoja 1 de Resumen Ejecutivo** con fórmulas vivas dinámicas vinculadas a las **Hojas 2 a 8 de Detalle por Magnitud**.
3. **Exportador de Informe PDF Ejecutivo:** Documento membretado institucional para directorio con carátula ejecutiva, tabla P&L, gráficos de absorción de gastos y campo de firmas de cierre.

---

## 2. Criterio Contable y Estructura del P&L Dual

### 2.1. Criterio Dual Integrado
* **Visión Económica (Devengado / P&L):** Computa todas las ventas facturadas/emitidas en septiembre, el costo de mercaderías atribuible a las ventas del mes, y todos los gastos y remuneraciones generados en septiembre, sin importar si su fecha de liquidación o pago en bancos fue posterior.
* **Visión Financiera (Flujo de Caja y Bancos):** Concilia los cobros efectivos percibidos contra los pagos reales desembolsados (transferencias, cheques debitados, pagos en efectivo) y el saldo remanente exigible en Cuentas por Pagar comerciales.

---

## 3. Arquitectura del Reporte: Las 8 Magnitudes

### Hoja 1: Resumen Ejecutivo (Estado de Resultados y Conciliación de Fondos)
Diseñada en cascada con análisis vertical de participación sobre Ventas Netas:

1. **(+) Ingresos Operativos:**
   - Ventas Brutas de Salón (POS) desglosadas por canal de cobro:
     * Ventas Efectivo Guaraníes
     * Ventas Tarjetas Bancard y Dinelco
     * Ventas Transferencias, PIX y Códigos QR
   - *(-) Descuentos comerciales y cancelaciones.*
   - **(=) Ventas Netas Totales (100.0%)**
2. **(-) Costo de Mercaderías Vendidas (CMV):**
   - Compras de reposición y costo directo de mercaderías reventa del mes.
3. **(=) Utilidad Bruta (Margen Bruto Gs. y % s/ Ventas)**
4. **(-) Gastos Operativos (OPEX) Clasificados:**
   - **Magnitud 4. Gastos de Personal (Sueldos y Jornales):**
     * Salarios y jornales brutos devengados
     * Horas extras y adicionales de nocturnidad/feriados
     * Cargas sociales patronales obligatorias (IPS Patronal 16.5%)
     * Provisión de aguinaldo devengado de septiembre (8.33% / 1/12)
     * Gastos directos de personal (uniformes, refrigerio de salón, medicina laboral, viáticos)
   - **Magnitud 5. Ocupación y Servicios Básicos:**
     * Alquiler del inmueble comercial
     * Energía eléctrica (ANDE) y Agua corriente (Essap)
     * Seguridad y vigilancia física
     * Servicios de aseo y desinfección
   - **Magnitud 6. Mantenimiento, Equipamiento e Infraestructura:**
     * Mantenimiento de cámaras de frío y equipamiento de carnicería/panadería
     * Servicio técnico de balanzas electrónicas y terminales POS
     * Obras civiles, fachada y ferretería
   - **Magnitud 7. Logística, Operación e Insumos:**
     * Fletes, fletes de compras y combustible de flota
     * Insumos de empaque (bolsas biodegradables, bobinas térmicas para cajas)
   - **Magnitud 8. Administración, Tecnología y Asesoría:**
     * Servicios de software, hosting y licencias
     * Honorarios profesionales (contable, auditoría, legal)
     * Papelería y suministros administrativos
5. **(=) EBITDA (Resultado Operativo Bruto)**
6. **(-) Gastos Financieros e Impuestos:**
   - Comisiones por procesamiento de cobros electrónicos (Bancard, Dinelco, PlugPay)
   - Mantenimiento de cuentas bancarias y débitos bancarios
   - Impuestos y tasas municipales devengadas
7. **(=) RESULTADO NETO DEL EJERCICIO (Septiembre 2026)**
8. **Conciliación Financiera Anexa:**
   - Cobranzas efectivas del mes en caja y bancos.
   - Egresos financieros desembolsados (cheques cobrados y transferencias emitidas).
   - **Saldo Oficial Calibrado al 30/09/2026:** Gs. 73.874.004 (Banco Continental Gs. 57.227.330 + Banco Interfisa Gs. 16.646.674).
   - Pasivo exigible en Cuentas por Pagar a vencer.

---

### Hojas 2 a 8: Detalle Analítico por Magnitud

Todas las hojas analíticas mantienen la misma estructura tabular normalizada:
`[Fecha | Comprobante | Proveedor / Beneficiario | RUC | Detalle del Concepto | Subcategoría | Medio de Pago / Banco | Monto (Gs.) | Estado]`

* **Hoja 2 (`Detalle Ingresos`):** Transacciones diarias de venta, turnos de caja, cierres Z y notas de crédito.
* **Hoja 3 (`Detalle CMV Mercaderías`):** Facturas de proveedores comerciales de comestibles, bebidas, carnes y frescos.
* **Hoja 4 (`Detalle Nómina SueldOK`):** Planilla nominal de colaboradores: CI, Nombre, Cargo, Departamento, Salario Base, Horas Extras, IPS Obrero (9%), IPS Patronal (16.5%), Provisión Aguinaldo, Descuentos internos/anticipos, Neto a cobrar y Gastos asociados (uniformes, refrigerios).
* **Hoja 5 (`Detalle Ocupación y Servicios`):** Facturas de alquiler, ANDE, Essap, seguridad privada.
* **Hoja 6 (`Detalle Mantenimiento e Infraestructura`):** Facturas de técnicos frigoristas, balanzas, cerrajería y ferretería.
* **Hoja 7 (`Detalle Logística e Insumos`):** Facturas de fletes, estaciones de servicio (combustible), proveedores de bolsas y bobinas.
* **Hoja 8 (`Detalle Administración y Finanzas`):** Extracto de comisiones Bancard/Dinelco, honorarios y gastos bancarios.

---

## 4. Arquitectura de Software y Componentes

### 4.1. Backend (`api/src/financial/`)

1. **`monthly_closing_service.py`:**
   - Agregación atómica de fuentes de datos.
   - Algoritmo de clasificación con diccionarios de mapeo y fallback a `"Gastos Pendientes de Clasificar"` si algún comprobante carece de categoría.
   - Cálculo automático de IPS Patronal (16.5%) y Provisión de Aguinaldo (1/12) a partir de la masa salarial bruta devengada.
   - Enlace automático con los saldos calibrados en `api/audit_datos_dryrun.py` y el informe de conciliación de septiembre.

2. **`router_closing.py`:**
   - `GET /api/v1/financial/closing/summary`: Resumen P&L y métricas.
   - `GET /api/v1/financial/closing/details/{magnitude}`: Lista de registros por magnitud.
   - `GET /api/v1/financial/closing/export/excel`: Streaming del `.xlsx` generado con `openpyxl`.
   - `GET /api/v1/financial/closing/export/pdf`: Streaming del PDF ejecutivo con estilos institucionales.

### 4.2. Frontend (`ui-web/src/pages/financial/`)

1. **`MonthlyClosingPage.tsx`:**
   - Componente maestro con barra superior de filtros de mes/año y botones de exportación.
   - Franja superior con 6 tarjetas KPI (Ventas Netas, Margen Bruto %, Total OPEX, Carga Laboral %, EBITDA, Resultado Neto).
   - Componente de P&L en cascada interactivo (`ClosingPnlTable.tsx`).
   - Pestañas dinámicas para navegar a las tablas de detalle por magnitud (`ClosingMagnitudeDetail.tsx`).
   - Modal/Panel para clasificar gastos pendientes de catalogación en tiempo real.

---

## 5. Pruebas y Validación

1. **Validación de Integridad Numérica:**
   - La suma de todas las filas de detalle en las Hojas 3 a 8 debe cuadrar exactamente al 100.0% con las cifras exhibidas en la Hoja 1.
2. **Validación de Fórmulas en Excel:**
   - Al abrir el archivo generado en Microsoft Excel / LibreOffice, la Hoja 1 debe contener fórmulas funcionales (`=SUM(...)`, `=B5-B12`, etc.) sin errores `#REF!` o `#VALUE!`.
3. **Validación Visual en UI Web:**
   - Comprobar correcta renderización en pantalla de escritorio y móvil, tiempos de carga < 1 segundo para el JSON consolidado de septiembre, y descarga fluida de archivos binarios (Excel y PDF).
