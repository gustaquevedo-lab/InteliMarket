# Integraciones — InteliMarket

## Ecosistema IntelliHouse

### InteliCont (Contabilidad)

InteliMarket envía eventos de negocio a InteliCont para generar asientos contables automáticamente.

#### Eventos que dispara InteliMarket

**1. Factura emitida (venta)**
```
POST {INTELICONT_WEBHOOK_URL}/invoice-issued
Headers:
  X-Signature: HMAC-SHA256(payload, INTELICONT_HMAC_SECRET)
  X-Event: invoice.issued
  Content-Type: application/json

Body:
{
  "tenant_id": "uuid",
  "company_id": "uuid",
  "company_ruc": "80012345-6",
  "cdc": "80012345678901234567890123456789012345678901",
  "tipo_de": "1",
  "numero": "001-001-0000123",
  "fecha": "2026-05-03T14:30:00-04:00",
  "condicion": "contado",
  "customer_ruc": "80098765-4",
  "customer_name": "JUAN PEREZ SA",
  "moneda": "PYG",
  "tipo_cambio": 1,
  "totales": {
    "base_gravada_10": 1000000,
    "base_gravada_5": 0,
    "base_exenta": 0,
    "iva_10": 100000,
    "iva_5": 0,
    "total": 1100000
  },
  "items": [
    {
      "producto_id": "uuid",
      "sku": "PROD-001",
      "descripcion": "Producto X",
      "cantidad": 2,
      "precio_unitario": 500000,
      "iva_tasa": 10,
      "total": 1000000
    }
  ],
  "payments": [
    {"method": "efectivo", "monto": 1100000}
  ]
}
```

**2. Compra recibida**
```
POST {INTELICONT_WEBHOOK_URL}/purchase-received
Headers:
  X-Signature: HMAC-SHA256(payload, ...)
  X-Event: purchase.received

Body:
{
  "tenant_id": "uuid",
  "company_id": "uuid",
  "company_ruc": "80012345-6",
  "supplier_ruc": "80054321-9",
  "supplier_name": "DISTRIBUIDORA SA",
  "numero_factura": "001-001-0000456",
  "cdc": "...",
  "fecha": "2026-05-03",
  "moneda": "PYG",
  "totales": {
    "base_gravada_10": 5000000,
    "base_gravada_5": 0,
    "base_exenta": 0,
    "iva_10": 500000,
    "total": 5500000
  },
  "items": [...]
}
```

**3. Pago/cobro registrado**
```
POST {INTELICONT_WEBHOOK_URL}/payment-recorded
Headers:
  X-Event: payment.recorded

Body:
{
  "tenant_id": "uuid",
  "company_id": "uuid",
  "payment_id": "uuid",
  "tipo": "cobro",
  "method": "tarjeta_debito",
  "monto": 1100000,
  "moneda": "PYG",
  "sale_id": "uuid",
  "fecha": "2026-05-03T15:00:00-04:00"
}
```

**4. Cierre de período (mensual)**
```
POST {INTELICONT_WEBHOOK_URL}/period-closed
Headers:
  X-Event: period.closed

Body:
{
  "tenant_id": "uuid",
  "company_id": "uuid",
  "company_ruc": "80012345-6",
  "periodo": "2026-04",
  "snapshot": {
    "ventas_total": 150000000,
    "ventas_iva_debito": 15000000,
    "compras_total": 80000000,
    "compras_iva_credito": 8000000,
    "cobros_total": 145000000,
    "pagos_total": 75000000,
    "cdc_ventas": ["...", "..."],
    "cdc_compras": ["...", "..."]
  },
  "hash": "sha256(snapshot + secret)"
}
```

#### Respuesta esperada de InteliCont
```json
{
  "status": "accepted",
  "journal_entry_id": "uuid",
  "message": "Asiento contable generado exitosamente"
}
```

---

### InteliAudit (Auditoría impositiva)

InteliMarket provee snapshots mensuales de comprobantes para que InteliAudit realice cruces con Marangatú, SIFEN, y HECHAUKA.

#### Snapshot mensual
```
POST {INTELIAUDIT_WEBHOOK_URL}/monthly-snapshot
Headers:
  X-Signature: HMAC-SHA256(payload, INTELIAUDIT_HMAC_SECRET)
  X-Event: monthly.snapshot

Body:
{
  "tenant_id": "uuid",
  "company_ruc": "80012345-6",
  "company_name": "MI EMPRESA SA",
  "periodo": "2026-04",
  "regimen_tributario": "general",
  "ventas": {
    "cantidad_comprobantes": 1523,
    "base_gravada_10": 450000000,
    "base_gravada_5": 12000000,
    "base_exenta": 5000000,
    "iva_debito_10": 45000000,
    "iva_debito_5": 600000,
    "cdc_list": [
      {"cdc": "80012345678901234567890123456789012345678901", "tipo_de": "1", "numero": "001-001-0000001", "fecha": "2026-04-01", "total": 1100000}
    ]
  },
  "compras": {
    "cantidad_comprobantes": 847,
    "base_gravada_10": 280000000,
    "base_gravada_5": 8000000,
    "base_exenta": 3000000,
    "iva_credito_10": 28000000,
    "iva_credito_5": 400000,
    "cdc_list": [
      {"cdc": "80098765432109876543210987654321098765432109", "tipo_de": "1", "numero": "002-001-0000456", "fecha": "2026-04-03", "total": 5500000, "supplier_ruc": "80054321-9"}
    ]
  },
  "retenciones_practicadas": [
    {"form": "800", "ruc_retendido": "80011111-1", "monto_base": 1000000, "monto_retencion": 30000}
  ],
  "hash": "sha256(compressed_snapshot)"
}
```

#### Consulta de hallazgos
```
GET /v1/integrations/inteliaudit/findings?company_ruc=80012345-6&periodo=2026-04

Response:
{
  "findings": [
    {
      "id": "uuid",
      "tipo": "cdc_invalido",
      "riesgo": "alto",
      "descripcion": "CDC 800... no existe en SIFEN",
      "articulo_legal": "RG 69/2020",
      "monto_afectado": 1100000,
      "ajuste_estimado": 110000,
      "comprobante": "001-001-0000123"
    }
  ]
}
```

---

### SueldOK (Recursos Humanos)

#### Pull de nómina cerrada
```
GET {SUELDOK_API_URL}/api/payroll/closed?company_ruc=80012345-6&periodo=2026-04
Headers:
  Authorization: Bearer {SUELDOK_API_KEY}

Response:
{
  "periodo": "2026-04",
  "company_ruc": "80012345-6",
  "empleados": [
    {
      "id": "uuid",
      "nombre": "Juan Pérez",
      "ci": "1234567",
      "cargo": "Vendedor",
      "sueldo_bruto": 5000000,
      "ips_empleado": 450000,
      "ips_empleador": 850000,
      "irp_retencion": 150000,
      "sueldo_neto": 4400000,
      "costo_total_empleador": 5850000
    }
  ],
  "totales": {
    "sueldos_brutos": 50000000,
    "ips_empleado": 4500000,
    "ips_empleador": 8500000,
    "irp_retencion": 1500000,
    "sueldos_netos": 44000000,
    "costo_total": 58500000
  }
}
```

#### Push de empleados nuevos (opcional)
```
POST {SUELDOK_API_URL}/api/employees
Headers:
  Authorization: Bearer {SUELDOK_API_KEY}

Body:
{
  "company_ruc": "80012345-6",
  "employee": {
    "nombre": "María López",
    "ci": "7654321",
    "ruc": null,
    "fecha_nacimiento": "1990-05-15",
    "cargo": "Cajera",
    "sueldo_base": 4500000,
    "fecha_ingreso": "2026-05-01",
    "comision_pct": 2,
    "sucursal": "Central"
  }
}
```

---

## Pasarelas de Pago Paraguay

### Pagopar

#### Crear checkout
```
POST https://api.pagopar.com/v1/checkout
Headers:
  Authorization: Bearer {PAGOPAR_API_KEY}

Body:
{
  "amount": 1100000,
  "currency": "PYG",
  "description": "Compra #001-001-0000123",
  "callback_url": "https://api.intelimarket.py/v1/gateways/pagopar/callback",
  "success_url": "https://app.intelimarket.py/sales/uuid",
  "failure_url": "https://app.intelimarket.py/pos/payment-failed",
  "metadata": {
    "sale_id": "uuid",
    "tenant_id": "uuid"
  }
}

Response:
{
  "payment_id": "pgp_xxx",
  "checkout_url": "https://checkout.pagopar.com/pay/pgp_xxx"
}
```

#### Callback de confirmación
```
POST /api/v1/gateways/pagopar/callback
Body:
{
  "payment_id": "pgp_xxx",
  "status": "approved",
  "amount": 1100000,
  "currency": "PYG",
  "authorization_code": "123456",
  "metadata": {
    "sale_id": "uuid",
    "tenant_id": "uuid"
  },
  "signature": "hmac_signature"
}
```

### Kuapay

#### Generar QR de pago
```
POST https://api.kuapay.com/v1/payments
Headers:
  Authorization: Bearer {KUAPAY_API_KEY}

Body:
{
  "amount": 1100000,
  "currency": "PYG",
  "reference": "INTMK-001-001-0000123",
  "webhook_url": "https://api.intelimarket.py/v1/gateways/kuapay/webhook",
  "description": "Compra en POS"
}

Response:
{
  "payment_id": "kpy_xxx",
  "qr_code": "base64_qr_image",
  "qr_string": "kuapay://pay?amount=1100000&ref=INTMK-...",
  "expires_at": "2026-05-03T14:35:00-04:00"
}
```

#### Webhook de confirmación
```
POST /api/v1/gateways/kuapay/webhook
Body:
{
  "payment_id": "kpy_xxx",
  "status": "paid",
  "amount": 1100000,
  "reference": "INTMK-001-001-0000123",
  "paid_at": "2026-05-03T14:32:15-04:00",
  "signature": "hmac_signature"
}
```

---

## BCP (Banco Central del Paraguay)

### Tipos de cambio
```
GET {BCP_API_URL}/tipo-cambio-referencial?fecha=2026-05-03

Response:
{
  "fecha": "2026-05-03",
  "monedas": [
    {"codigo": "USD", "compra": 7350, "venta": 7450},
    {"codigo": "BRL", "compra": 1420, "venta": 1480},
    {"codigo": "ARS", "compra": 8.50, "venta": 9.20},
    {"codigo": "EUR", "compra": 8050, "venta": 8200}
  ]
}
```

---

## Contratos de eventos (CloudEvents 1.0)

Todos los webhooks siguen el formato CloudEvents:

```json
{
  "specversion": "1.0",
  "type": "invoice.issued",
  "source": "intelimarket",
  "id": "uuid",
  "time": "2026-05-03T14:30:00-04:00",
  "tenant_id": "uuid",
  "company_ruc": "80012345-6",
  "data": { ... }
}
```

### Idempotencia

Todos los webhooks incluyen `X-Idempotency-Key` en el header. El receptor debe ignorar eventos duplicados.

### Reintentos

- Intento 1: inmediato
- Intento 2: 1 minuto
- Intento 3: 5 minutos
- Intento 4: 15 minutos
- Intento 5: 1 hora
- Después de 5 intentos: marcado como fallido, alertar al tenant
