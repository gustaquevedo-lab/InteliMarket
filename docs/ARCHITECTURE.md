# Arquitectura — InteliMarket

## Qué es este producto

**InteliMarket** es un SaaS ERP verticalizable para comercios y distribuidores en Paraguay, parte del ecosistema **IntelliHouse Soluciones**. Gestiona ventas, compras, inventario, facturación electrónica SIFEN, punto de venta (POS), cobros, pagos, y se integra nativamente con InteliCont (contabilidad), InteliAudit (auditoría impositiva), y SueldOK (recursos humanos).

**Diferenciadores:**
- Compliance 100% con DNIT/SET Paraguay (facturación electrónica e-Kuatia)
- Multimoneda nativa (PYG, USD + configurables)
- POS offline-first (PWA)
- Integración bidireccional con ecosistema IntelliHouse
- Pasarelas de pago Paraguay (Pagopar, Kuapay)
- Wallet interna + crédito rotativo + financiamiento

---

## Stack tecnológico

### Backend
```
Python 3.12+
FastAPI             → API REST + WebSocket
SQLAlchemy 2.0      → ORM con async support
Alembic             → Migraciones de BD
Pydantic v2         → Validación y schemas
python-jose         → JWT auth
passlib[bcrypt]     → Hash de contraseñas
httpx               → HTTP client (SIFEN, pasarelas)
lxml                → Parser XML e-Kuatia
httpx               → Client HTTP async
celery              → Task queue (jobs async)
redis               → Broker + cache
weasyprint          → Generación PDF
anthropic           → Claude API (IA para pricing, forecasting, sugerencias)
```

### Frontend
```
React 18 + TypeScript
Vite                → Build tool
React Router v6     → Routing
TailwindCSS v3      → Styling
Zustand             → State management
TanStack Query      → Server state + cache
React Hook Form     → Formularios
Zod                 → Validación de forms
Lucide React        → Iconos
Recharts            → Gráficos
date-fns            → Manejo de fechas
xlsx                → Export/import Excel
```

### Infraestructura
```
PostgreSQL 16       → Base de datos (schema por tenant)
Redis 7             → Cache + Celery broker
Nginx               → Reverse proxy
Docker              → Contenedores
```

---

## Estructura del proyecto

```
intelimarket/
├── api/                          # Backend Python/FastAPI
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI app entry
│   │   ├── config.py             # Settings (pydantic-settings)
│   │   ├── auth/                 # Autenticación y autorización
│   │   │   ├── jwt.py
│   │   │   ├── permissions.py
│   │   │   └── middleware.py     # Tenant resolution middleware
│   │   ├── tenants/              # Gestión de tenants/schemas
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py        # Schema provisioning
│   │   │   └── router.py
│   │   ├── companies/            # Empresas (dentro de un tenant)
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   └── router.py
│   │   ├── products/             # Catálogo de productos/servicios
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   ├── categories.py
│   │   │   ├── variants.py
│   │   │   ├── pricing.py        # Listas de precio, descuentos
│   │   │   └── router.py
│   │   ├── inventory/            # Inventario completo
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   ├── warehouses.py     # Multi-almacén
│   │   │   ├── movements.py      # Entradas, salidas, ajustes
│   │   │   ├── transfers.py      # Transferencias entre almacenes
│   │   │   ├── costing.py        # FIFO, LIFO, promedio ponderado
│   │   │   ├── batches.py        # Lotes + vencimientos
│   │   │   ├── serials.py        # Numeración de serie
│   │   │   └── router.py
│   │   ├── sales/                # Ventas y POS
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   ├── pos.py            # Punto de venta
│   │   │   ├── invoices.py       # Facturación (e-Kuatia)
│   │   │   ├── quotes.py         # Cotizaciones
│   │   │   ├── returns.py        # Notas de crédito/devoluciones
│   │   │   └── router.py
│   │   ├── purchases/            # Compras
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   ├── orders.py         # Órdenes de compra
│   │   │   ├── receiving.py      # Recepción de mercadería
│   │   │   └── router.py
│   │   ├── suppliers/            # Proveedores
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   └── router.py
│   │   ├── customers/            # Clientes
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   ├── crm.py            # CRM básico (oportunidades)
│   │   │   └── router.py
│   │   ├── payments/             # Cobros y pagos
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   ├── methods.py        # Efectivo, tarjetas, transferencia, cheques
│   │   │   ├── wallet.py         # Wallet interna
│   │   │   ├── credit.py         # Crédito rotativo, cuentas corrientes
│   │   │   ├── financing.py      # Financiamiento en cuotas
│   │   │   ├── split.py          # Split payments
│   │   │   └── router.py
│   │   ├── gateways/             # Pasarelas de pago
│   │   │   ├── pagopar.py
│   │   │   ├── kuapay.py
│   │   │   ├── base.py
│   │   │   └── router.py
│   │   ├── sifen/                # Facturación electrónica SIFEN
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── client.py         # Conexión API SIFEN
│   │   │   ├── xml_generator.py  # Generación XML e-Kuatia
│   │   │   ├── cdc.py            # Cálculo y validación CDC
│   │   │   ├── timbrado.py       # Gestión de timbrados
│   │   │   ├── responses.py      # Procesamiento respuestas SIFEN
│   │   │   └── router.py
│   │   ├── logistics/            # Logística (distribución)
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── routes.py         # Rutas de entrega
│   │   │   ├── deliveries.py     # Entregas + albaranes
│   │   │   └── router.py
│   │   ├── reports/              # Reportes
│   │   │   ├── sales.py
│   │   │   ├── inventory.py
│   │   │   ├── financial.py
│   │   │   ├── tax.py            # Reportes fiscales (IVA, IRE)
│   │   │   ├── pdf_generator.py
│   │   │   └── router.py
│   │   ├── integrations/         # Integraciones ecosistema
│   │   │   ├── intelicont.py     # Webhooks a InteliCont
│   │   │   ├── inteliaudit.py    # Webhooks a InteliAudit
│   │   │   ├── sueldok.py        # API SueldOK
│   │   │   ├── webhooks.py       # Webhook genérico
│   │   │   └── router.py
│   │   ├── currency/             # Multimoneda
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── rates.py          # Tipos de cambio (BCP API)
│   │   │   └── router.py
│   │   ├── branches/             # Sucursales
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   └── router.py
│   │   ├── users/                # Usuarios y roles
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   └── router.py
│   │   ├── audit/                # Audit trail
│   │   │   ├── models.py
│   │   │   ├── service.py
│   │   │   └── middleware.py
│   │   └── tasks/                # Celery tasks
│   │       ├── sifen_sync.py
│   │       ├── currency_sync.py
│   │       ├── inventory_alerts.py
│   │       └── report_gen.py
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── ui-web/                       # Frontend React
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css             # Identidad visual Intelimarket
│   │   ├── api/                  # API client (fetch wrapper)
│   │   ├── components/           # Componentes compartidos
│   │   │   ├── Layout.tsx        # Sidebar + header
│   │   │   ├── Logo.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toaster.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── KPICard.tsx
│   │   │   └── CurrencyDisplay.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── ThemeContext.tsx
│   │   │   └── TenantContext.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useCurrency.ts
│   │   │   └── usePermissions.ts
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── pos/              # Punto de venta
│   │   │   ├── sales/
│   │   │   ├── purchases/
│   │   │   ├── inventory/
│   │   │   ├── products/
│   │   │   ├── customers/
│   │   │   ├── suppliers/
│   │   │   ├── payments/
│   │   │   ├── logistics/
│   │   │   ├── reports/
│   │   │   ├── sifen/            # Facturación electrónica
│   │   │   ├── settings/
│   │   │   └── admin/
│   │   ├── utils/
│   │   └── types/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── db/
│   ├── schema.sql                # Schema maestro
│   └── migrations/               # Alembic migrations
├── docs/
│   ├── ARCHITECTURE.md           ← Este archivo
│   ├── PRD.md
│   ├── INTEGRATIONS.md
│   ├── FISCAL_PY_RULES.md
│   ├── ROADMAP.md
│   ├── BACKLOG.md
│   └── API.md
├── infra/
│   ├── docker-compose.yml
│   ├── nginx.conf
│   └── deploy/
├── scripts/
├── pyproject.toml                # Backend config
├── .env.example
└── README.md
```

---

## Multi-tenancy: Schema por tenant

Cada tenant (suscriptor del SaaS) tiene su propio schema PostgreSQL:

```sql
-- Schema master (schema: public)
-- Contiene: tenants, users, subscriptions, plans

-- Schema por tenant: tenant_{uuid}
-- Contiene: companies, products, sales, inventory, etc.

-- Flujo de resolución de tenant:
-- 1. Request llega con JWT → extraer tenant_id del claim
-- 2. Middleware ejecuta: SET search_path TO tenant_{uuid}, public
-- 3. Todas las queries van al schema del tenant
-- 4. Solo tablas master son accesibles desde public
```

```python
# Tenant middleware
@app.middleware("http")
async def tenant_middleware(request: Request, call_next):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    payload = decode_jwt(token)
    tenant_id = payload["tenant_id"]
    
    # Set search_path para la conexión actual
    async with db_session() as session:
        await session.execute(text(f"SET search_path TO tenant_{tenant_id}, public"))
        request.state.tenant_id = tenant_id
        request.state.db_session = session
        
        response = await call_next(request)
        return response
```

---

## Integraciones con ecosistema IntelliHouse

### InteliCont (Contabilidad)
```python
# Cuando se cierra una venta con factura electrónica:
POST /v1/integrations/intelimarket/invoice-issued
{
    "tenant_id": "...",
    "company_id": "...",
    "cdc": "80012345678901234567890123456789012345678901",
    "tipo_de": "1",  # Factura
    "ruc_emisor": "80012345-6",
    "ruc_receptor": "80098765-4",
    "fecha": "2026-05-03T14:30:00",
    "totales": {
        "grav10": 1000000,
        "grav5": 0,
        "exento": 0,
        "iva10": 100000,
        "iva5": 0,
        "total": 1100000
    },
    "items": [
        {"producto_id": "...", "cantidad": 2, "precio": 500000, "iva": 10}
    ],
    "moneda": "PYG"
}
# → InteliCont propone asiento contable (venta, IVA débito, costo/mercadería)
```

### InteliAudit (Auditoría impositiva)
```python
# Snapshot mensual de ventas/compras para auditoría:
POST /v1/integrations/inteliaudit/monthly-snapshot
{
    "tenant_id": "...",
    "company_ruc": "80012345-6",
    "periodo": "2026-04",
    "ventas": {
        "total_comprobantes": 1523,
        "total_grav10": 450000000,
        "total_grav5": 12000000,
        "total_exento": 5000000,
        "total_iva_debito": 46200000,
        "cdc_list": ["...", "..."]  # Todos los CDCs emitidos
    },
    "compras": {
        "total_comprobantes": 847,
        "total_grav10": 280000000,
        "total_grav5": 8000000,
        "total_exento": 3000000,
        "total_iva_credito": 28800000,
        "cdc_list": ["...", "..."]  # Todos los CDCs recibidos
    },
    "hash": "sha256(...)"  # Firma del snapshot
}
```

### SueldOK (Recursos humanos)
```python
# Pull de datos de nómina para imputación contable:
GET /api/sueldok/payroll/{period}?tenant_id=...
# → SueldOK retorna nómina cerrada
# → InteliCont genera asiento de sueldos, IPS, retenciones IRP

# Push de empleados desde InteliMarket a SueldOK (opcional):
POST /v1/integrations/sueldok/employee
{
    "nombre": "...",
    "ruc": "...",  # si tiene
    "cargo": "Vendedor",
    "sueldo_base": 5000000,
    "comision_pct": 5
}
```

### Pasarelas de pago Paraguay

#### Pagopar
```python
# Checkout
POST https://api.pagopar.com/v1/checkout
{
    "amount": 1100000,
    "currency": "PYG",
    "description": "Compra #1234",
    "callback_url": "https://intelimarket.py/api/v1/gateways/pagopar/callback",
    "success_url": "https://app.intelimarket.py/sales/1234",
    "failure_url": "https://app.intelimarket.py/pos/failed"
}

# Callback/webhook
POST /api/v1/gateways/pagopar/callback
{
    "transaction_id": "...",
    "status": "approved",
    "amount": 1100000,
    "authorization_code": "..."
}
```

#### Kuapay
```python
# Kuapay usa QR dinámico (similar a Pix brasileño)
POST https://api.kuapay.com/v1/payments
{
    "amount": 1100000,
    "currency": "PYG",
    "reference": "INTMK-1234",
    "webhook_url": "https://intelimarket.py/api/v1/gateways/kuapay/webhook"
}
# → Retorna QR string → POS lo muestra
# → Webhook confirma pago
```

---

## Facturación electrónica SIFEN (e-Kuatia)

### Flujo de emisión
```
1. Usuario crea venta en POS → genera comprobante interno
2. Si es factura electrónica → genera XML e-Kuatia
3. Calcula CDC (Código de Control Digital)
4. Envía XML a SIFEN via API REST
5. Recibe respuesta → almacena XML firmado
6. Si "Aprobado" → imprime/envía factura al cliente
7. Si "Rechazado" → notifica error, permite corrección
```

### Estructura XML e-Kuatia (simplificada)
```xml
<DE>
  <gTimb>
    <dTiDE>1</dTiDE>           <!-- Tipo documento -->
    <dNumTim>12345678</dNumTim> <!-- Timbrado -->
    <dEst>001</dEst>           <!-- Establecimiento -->
    <dPunExp>001</dPunExp>     <!-- Punto de expedición -->
    <dNumDoc>0000123</dNumDoc> <!-- Número -->
    <dFeIniT>2026-01-01</dFeIniT>
    <dFeFinT>2026-12-31</dFeFinT>
  </gTimb>
  <gDatGralOpe>
    <dFeEmiDE>2026-05-03T14:30:00</dFeEmiDE>
    <dCond>1</dCond>           <!-- 1=Contado, 2=Crédito -->
    <gDatRec>
      <dRucRec>80098765-4</dRucRec>
      <dNomRec>JUAN PEREZ SA</dNomRec>
    </gDatRec>
  </gDatGralOpe>
  <gDtipProServ>
    <gItem>
      <dDesProServ>PRODUCTO X</dDesProServ>
      <dCantPro>2.000</dCantPro>
      <dPUniPro>500000</dPUniPro>
      <dTotPro>1000000</dTotPro>
      <dTasaIVA>10</dTasaIVA>
      <dIVAItem>100000</dIVAItem>
    </gItem>
  </gDtipProServ>
  <gTotSub>
    <dTotGravOp10>1000000</dTotGravOp10>
    <dTotGravOp5>0</dTotGravOp5>
    <dTotExe>0</dTotExe>
    <dTotIVA>100000</dTotIVA>
    <dTotGe>1100000</dTotGe>
  </gTotSub>
  <Id>CDC_44_DIGITOS</Id>
</DE>
```

### Tipos de documento (dTiDE)
| Código | Tipo |
|--------|------|
| 1 | Factura (e-Kuatia) |
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

---

## Multimoneda

### Tipos de cambio
- Fuente principal: API del Banco Central del Paraguay (BCP)
- Actualización diaria vía Celery task
- Configuración manual override por tenant
- Historial de tipos de cambio almacenado

### Lógica de conversión
```python
# Toda transacción se registra en su moneda original
# Y se almacena el equivalente en PYG al tipo de cambio del día

class Transaction(Base):
    moneda_original = Column(String(3))    # PYG, USD, BRL
    monto_original = Column(Numeric(15,0)) # Sin decimales para PYG
    tipo_cambio = Column(Numeric(10,2))    # 1 USD = X PYG
    monto_pyg = Column(Numeric(15,0))      # Convertido

# Regla fiscal: declaraciones a SET siempre en PYG
```

---

## Costeo de inventario

### Métodos soportados
1. **Promedio Ponderado (default)**
   ```
   Costo_promedio = (Stock_actual × Costo_anterior + Entrada × Costo_entrada) / (Stock_actual + Entrada)
   ```

2. **FIFO (First In, First Out)**
   - Cada entrada crea un "layer" con su costo
   - Las salidas consumen los layers más antiguos primero

3. **LIFO (Last In, First Out)**
   - Las salidas consumen los layers más recientes primero
   - Nota: No aceptado fiscalmente en Paraguay, disponible solo para gestión interna

### Configuración por producto
```python
class Product(Base):
    metodo_costeo = Column(Enum('promedio', 'fifo', 'lifo'))  # por producto
    # O heredado de categoría/empresa
```

---

## Modelo de planes SaaS

### Tabla de planes
| Feature | Starter | Professional | Business | Enterprise |
|---------|---------|-------------|----------|------------|
| Sucursales | 1 | 3 | 10 | Ilimitadas |
| Puntos de venta | 1 | 3 | 10 | Ilimitados |
| Usuarios | 2 | 10 | 50 | Ilimitados |
| Facturas/mes | 500 | 5,000 | 50,000 | Ilimitadas |
| Productos | 500 | 10,000 | Ilimitados | Ilimitados |
| Almacenes | 1 | 3 | 10 | Ilimitados |
| Listas de precio | 1 | 3 | 10 | Ilimitadas |
| Integraciones | Básica | Completa | Completa | +API custom |
| Pasarelas de pago | 1 | 2 | Todas | Todas |
| Soporte | Email | Email + Chat | Prioritario | Dedicado |
| SLA | 99% | 99.5% | 99.9% | 99.95% |

---

## Verticales y módulos

### Retail / Tiendas
- POS offline-first (PWA)
- Gestión de caja (apertura, cierre, arqueos)
- Lectores de código de barras
- Impresoras térmicas
- Promociones y descuentos
- Fidelización de clientes
- Stock mínimo y alertas
- Reportes de ventas por hora/día/semana

### Distribución / Mayorista
- Órdenes de compra a proveedores
- Recepción de mercadería
- Listas de precio por canal/volumen
- Pedido mínimo por cliente
- Gestión de pedidos de clientes
- Rutas de entrega
- Albaranes con firma
- CRM básico (oportunidades, cotizaciones)
- Facturación recurrente
- Cuentas corrientes con límite de crédito

---

## Seguridad y compliance

### Autenticación
- JWT con refresh tokens
- MFA opcional (TOTP)
- Sesiones concurrentes limitadas por plan
- IP whitelist para Enterprise

### Autorización
- RBAC (Role-Based Access Control)
- Permisos granulares por módulo
- Permisos por sucursal
- Audit trail de todas las acciones

### Compliance Paraguay
- Facturación electrónica SIFEN
- Timbrado DNIT
- RG 90 (detalle comprobantes)
- HECHAUKA (información de terceros)
- Retenciones automáticas
- Libros IVA automáticos
- Declaraciones pre-llenadas (Form. 120, 500)

### Datos
- Encriptación en tránsito (TLS 1.3)
- Encriptación en reposo (AES-256 para campos sensibles)
- Backups automáticos diarios
- Retención de datos según Ley 6380 (10 años)

---

## Performance y escalabilidad

### Objetivos
- POS: respuesta < 100ms (cache local)
- API: P95 < 300ms
- Generación factura SIFEN: < 3s
- Reportes complejos: < 10s (async)

### Estrategias
- Redis para cache de catálogo, precios, tipos de cambio
- WebSocket para actualizaciones de stock en tiempo real
- Celery para jobs async (generación PDFs, sync SIFEN, reportes)
- Connection pooling (PgBouncer)
- Read replicas para reportes pesados

---

## Identidad visual InteliMarket

**Paleta:**
- Azul IntelliHouse: `#104c91` (primary) — herencia del ecosistema
- Verde mercado: `#00a651` (secondary) — herencia del ecosistema
- Naranja market: `#F97316` (accent) — diferenciador para Intelimarket
- Navy oscuro: `#0F172A` (fondos oscuros, sidebar dark)
- Gris texto: `#64748B` (labels, secundario)
- Border: `#E2E8F0`
- Background: `#F8FAFC` (fondo general), `#FFFFFF` (cards)

**Logo:** isotipo squircle azul + símbolo de carrito/mercado + acento naranja
**Wordmark:** `<span blue bold>Inteli</span><span orange bold>market</span>`

**Niveles de estado (colores):**
- Success/Aprobado: `#22C55E` (verde)
- Warning/Pendiente: `#F59E0B` (ámbar)
- Error/Rechazado: `#EF4444` (rojo)
- Info: `#3B82F6` (azul)
- Nuevo/En proceso: `#F97316` (naranja market)

**Tipografía:** Inter (misma que Inteliaudit para consistencia del ecosistema)

---

## Reglas para desarrollo

1. **Todo en español** — UI, mensajes, documentación
2. **Montos en PYG sin decimales** — la moneda paraguaya no usa centavos
3. **RUC válido siempre** — validar dígito verificador antes de cualquier operación
4. **CDC único** — cada comprobante electrónico tiene un CDC irrepetible
5. **Períodos YYYY-MM** — formato consistente
6. **Schema por tenant** — nunca cruzar datos entre tenants
7. **Audit trail obligatorio** — toda modificación queda registrada
8. **Idempotency en webhooks** — todas las integraciones deben ser idempotentes
9. **Identidad visual consistente** — misma paleta, tipografía, patrones que el ecosistema
10. **Compliance primero** — cualquier feature fiscal debe validar con las reglas de FISCAL_PY_RULES.md
