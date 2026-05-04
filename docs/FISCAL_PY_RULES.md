# Reglas Fiscales Paraguay — InteliMarket

Este documento contiene todas las reglas tributarias paraguayas que InteliMarket debe validar y aplicar. Es la fuente de verdad para el módulo fiscal.

## Fuentes legales

- **Ley 6380/2019** — Modernización tributaria
- **Ley 125/1991** — Código tributario
- **Decreto 3107/2019** — Reglamentación IRE
- **Decreto 3181/2019** — Reglamentación IVA
- **RG 69/2020** — Facturación electrónica (e-Kuatia)
- **RG 80/2021** — Obligatoriedad e-Kuatia
- **RG 90/2021** — Detalle comprobantes en DJ IVA

---

## Regímenes tributarios

### Contribuyente General
- Obligado a facturación electrónica
- Declara IVA mensual (Form. 120)
- Declara IRE anual (Form. 500)
- Practica y declara retenciones
- Libros: IVA compras, IVA ventas, Diario, Mayor, Inventarios

### Contribuyente Simplificado (Single)
- No declara IVA (IVA incluido en impuesto single)
- Impuesto single: monto fijo según actividad
- No emite factura electrónica (solo comprobante fiscal o ticket)
- Obligaciones reducidas

### Pequeño Contribuyente (Small / IRP para personas)
- Régimen simplificado para personas físicas
- Impuesto fijo según actividad
- Límite de ingresos anuales: 100 millones PYG

---

## IVA (Impuesto al Valor Agregado)

### Alícuotas vigentes

| Tasa | Aplica a | Base legal |
|------|----------|------------|
| 10% | Operaciones generales (bienes y servicios) | Ley 6380 Art. 97 |
| 5% | Canasta básica, servicios personales, educación, salud | Ley 6380 Art. 98 |
| 0% | Exportaciones | Ley 6380 Art. 99 |
| Exento | Algunos bienes específicos | Ley 6380 Art. 100 |

### Cálculo del IVA

```
IVA incluido en precio:
  Base gravada = Total / (1 + tasa/100)
  IVA = Total - Base gravada

IVA sobre base:
  IVA = Base gravada × tasa/100
  Total = Base gravada + IVA
```

### Débito fiscal (ventas)
```
Débito fiscal = suma de IVA en facturas emitidas del período
```

### Crédito fiscal (compras)
```
Crédito fiscal = suma de IVA en facturas recibidas del período
```

**Requisitos para crédito fiscal válido:**
1. Comprobante legal vigente (factura electrónica con CDC válido)
2. Proveedor con RUC activo en DNIT
3. CDC existe y está aprobado en SIFEN
4. Comprobante registrado en RG 90 del período
5. No prescripto (5 años desde fecha del comprobante)

### IVA a pagar
```
IVA a pagar = Débito fiscal - Crédito fiscal
Si resultado > 0: pagar
Si resultado < 0: saldo a favor (trasladable al siguiente período)
```

### Proporcionalidad del crédito fiscal
Si el contribuyente tiene operaciones gravadas Y exentas/no gravadas:

```
CF_admitido = CF_total × (ventas_gravadas / ventas_totales)
```

### Formulario SET
- **Form. 120** — Declaración mensual de IVA
- Vencimiento: mes siguiente, según último dígito del RUC

---

## IRE (Impuesto a la Renta Empresarial)

### Alícuota
- **10%** sobre la renta neta imponible

### Base imponible
```
Renta bruta
- Costos y gastos deducibles
+ Reintegros y ajustes positivos
= Renta neta imponible × 10%
```

### Gastos NO deducibles (Art. 16 Ley 6380)
1. Multas, recargos e intereses pagados a SET/DNIT
2. Gastos personales del dueño/socios
3. Retiros de socios
4. Donaciones que superen el 1% de la renta bruta
5. Gastos sin comprobante legal vigente
6. Depreciaciones que superen tasas máximas
7. Intereses a partes vinculadas > LIBOR + 3%
8. Gastos de representación > 1% de ingresos brutos

### Tasas de depreciación máximas

| Bien | Tasa anual | Vida útil |
|------|-----------|-----------|
| Inmuebles | 2.5% | 40 años |
| Maquinaria | 10% | 10 años |
| Vehículos | 20% | 5 años |
| Equipos informáticos | 33.3% | 3 años |
| Muebles y útiles | 10% | 10 años |
| Instalaciones | 10% | 10 años |

### Formulario SET
- **Form. 500** — Declaración anual de IRE
- Ejercicio fiscal: 1 enero al 31 diciembre
- Vencimiento: abril del año siguiente

---

## Retenciones

### Agentes de retención
- Organismos del Estado
- Empresas designadas por SET/DNIT
- Cualquier contribuyente al contratar servicios personales

### Tasas de retención

| Concepto | Base | Tasa | Formulario |
|----------|------|------|------------|
| IVA a contrib. normal (agente designado) | 30% del IVA | 30% del IVA (≈3% del precio) | 800 |
| IVA a contrib. simplificado | Importe bruto | 30% del IVA teórico | 810 |
| IRE sobre honorarios/servicios | Importe bruto | Hasta 3% | 820 |
| IVA + IRE a pequeños contrib. | Importe bruto | 30% IVA + 2.5% IRE | 830 |

### Cálculo retención IVA
```
Retención IVA = IVA del comprobante × 30%
Ejemplo: Factura de ₲1.100.000 (IVA ₲100.000)
  Retención = ₲100.000 × 30% = ₲30.000
```

### Multas por retenciones
- Pago fuera de plazo: 0.1% diario sobre monto no depositado (máx. 20%)

---

## IDU (Impuesto a los Dividendos y Utilidades)

- **8%** sobre dividendos a residentes
- **15%** sobre dividendos a no residentes
- Formulario: 530

---

## IRP (Impuesto a la Renta Personal)

- **8%** hasta 10 salarios mínimos de renta neta
- **10%** sobre excedente de 10 salarios mínimos
- Formulario: 510
- Obligados: personas físicas con ingresos > 36 salarios mínimos anuales

---

## IRNR (Impuesto a la Renta de No Residentes)

- **15%** general sobre renta de fuente paraguaya
- Formulario: 520

---

## Facturación electrónica (e-Kuatia / SIFEN)

### Tipos de documento (dTiDE)
| Código | Tipo |
|--------|------|
| 1 | Factura |
| 2 | Factura de Exportación |
| 3 | Nota de Débito |
| 4 | Autofactura |
| 5 | Nota de Crédito |
| 6 | Factura de Compra |
| 7 | Comprobante de Retención |
| 8 | Comprobante de Pago |
| 9 | Remito Electrónico |
| 10 | Cuenta de Venta |
| 11 | Factura de Crédito |

### CDC (Código de Control Digital)
- 44 dígitos
- SHA256 de la estructura del documento
- Identifica de forma única cada comprobante electrónico
- Consulta pública: https://ekuatia.set.gov.py/consultas

### Timbrado
- Autorización de DNIT para emitir comprobantes
- Tiene número, vigencia, y rango numérico
- Se debe renovar antes del vencimiento

### Estructura número de comprobante
```
ESTABLECIMIENTO - PUNTO EXPEDICIÓN - SECUENCIAL
001             - 001                - 0000001
```

### Reglas de validación
1. RUC emisor debe estar activo
2. Timbrado debe estar vigente y con rango disponible
3. Secuencial no puede repetirse
4. CDC debe ser válido
5. Montos deben cuadrar (base + IVA = total)
6. No se pueden emitir facturas con fecha posterior a hoy
7. Notas de crédito deben referenciar factura original válida

---

## RG 90 — Detalle de comprobantes

El contribuyente debe declarar comprobante por comprobante en su DJ IVA:

### Campos requeridos por comprobante
- RUC del emisor/receptor
- Número de comprobante (EST-PUNEXP-SEQ)
- CDC (si es electrónico)
- Fecha de emisión
- Tipo de comprobante
- Monto gravado 10%
- Monto gravado 5%
- Monto exento
- IVA discriminado

### Validación cruzada
```
Total RG 90 ventas debe coincidir con Débito fiscal en Form. 120
Total RG 90 compras debe coincidir con Crédito fiscal en Form. 120
```

---

## Marangatú

Portal de DNIT para gestión tributaria: https://marangatu.set.gov.py

### Secciones usadas por InteliMarket
- Estado de cuenta tributario
- Obligaciones activas
- Declaraciones presentadas
- Timbrados vigentes

---

## Multas e intereses

### Multas (Ley 125/1991 Art. 175)
| Infracción | Multa |
|------------|-------|
| Omisión simple | 50% del impuesto omitido |
| Omisión contumaz (reincidencia) | 100% del impuesto omitido |
| Presentación fuera de término | 0.5% por mes (máx. 10%) |
| Falta de presentación | 1% por mes (máx. 20%) |

### Intereses moratorios
- **1% mensual** sobre deuda tributaria
- Se calculan desde el vencimiento hasta el pago efectivo

---

## Validaciones en InteliMarket

### Al crear una factura
```python
def validate_invoice(invoice):
    # 1. RUC activo
    assert is_ruc_active(invoice.company_ruc)
    assert is_ruc_active(invoice.customer_ruc) if invoice.customer_ruc

    # 2. Timbrado vigente
    timbrado = get_active_timbrado(invoice.company_id)
    assert timbrado.fecha_inicio <= invoice.fecha <= timbrado.fecha_fin

    # 3. Rango numérico
    assert timbrado.rango_desde <= invoice.secuencial <= timbrado.rango_hasta

    # 4. Secuencial no repetido
    assert not exists_invoice(invoice.company_id, invoice.numero)

    # 5. Cuadre de montos
    assert invoice.base_gravada_10 + invoice.base_gravada_5 + invoice.base_exenta == invoice.subtotal
    assert invoice.base_gravada_10 * 0.10 == invoice.iva_10 (aprox)
    assert invoice.base_gravada_5 * 0.05 == invoice.iva_5 (aprox)
    assert invoice.subtotal + invoice.iva_10 + invoice.iva_5 == invoice.total

    # 6. No fecha futura
    assert invoice.fecha <= now()
```

### Al registrar una compra
```python
def validate_purchase_comprobante(comprobante):
    # 1. CDC válido en SIFEN
    sifen_status = check_cdc_in_sifen(comprobante.cdc)
    assert sifen_status == "aprobado"

    # 2. Proveedor RUC activo
    assert is_ruc_active(comprobante.supplier_ruc)

    # 3. Comprobante no registrado antes
    assert not exists_comprobante(comprobante.cdc)
```

---

## Formulario 120 (IVA mensual) — Datos generados por InteliMarket

InteliMarket puede pre-llenar el Form. 120 con:

```
Sección A — Ventas:
  Total operaciones gravadas 10%
  Total operaciones gravadas 5%
  Total operaciones exentas
  Total IVA débito

Sección B — Compras:
  Total operaciones gravadas 10%
  Total operaciones gravadas 5%
  Total operaciones exentas
  Total IVA crédito

Sección C — Liquidación:
  IVA débito - IVA crédito = IVA a pagar / Saldo a favor

Detalle RG 90:
  Comprobante por comprobante (automático de ventas y compras del período)
```

---

## Notas para desarrollo

1. **Siempre validar contra FISCAL_PY_RULES.md** antes de implementar cualquier lógica fiscal
2. **Montos en PYG sin decimales** — la moneda paraguaya no usa centavos
3. **Todo comprobante fiscal necesita CDC válido** antes de considerar la operación como válida
4. **Las retenciones se calculan automáticamente** según el tipo de proveedor y operación
5. **Los reportes fiscales se generan en formato compatible** con Marangatú y los formularios SET
6. **Citar el artículo legal** en cada regla implementada
