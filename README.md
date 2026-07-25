# InteliMarket

SaaS ERP verticalizable para comercios y distribuidores en Paraguay. Multi-moneda, compliance SIFEN/e-Kuatia, integrado con InteliCont, InteliAudit y SueldOK.

## Stack

- **Frontend:** React + Vite + Tailwind CSS + lucide-react
- **Backend:** Python + FastAPI + PostgreSQL
- **Infra:** Docker Compose, Redis (cache)
- **Multi-tenancy:** Schema per tenant

## Quick Start

### Local (sin Docker)

```bash
# Backend
cd api
pip install -e .
uvicorn api.src.main:app --reload

# Frontend
cd ui-web
npm install
npm run dev
```

### Docker

```bash
docker compose up -d
```

- API: http://localhost:8000
- Docs: http://localhost:8000/api/docs
- Web: http://localhost:5173

## Ecosystem

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| InteliMarket | 8000/5173 | ERP principal |
| InteliCont | — | Contabilidad |
| InteliAudit | — | Auditoría |
| SueldOK | — | Nómina |

## Módulos

- **Auth** — JWT, MFA, multi-tenant
- **Companies** — Empresas, sucursales, puntos de expedición
- **Products** — SKU, código de barra, categorías, precios, variantes
- **Inventory** — Stock, almacenes, transferencias, ajustes, lotes, seriales, FIFO/Promedio
- **Sales** — Ventas, cotizaciones, cálculo automático IVA (10/5/0), deducción de stock
- **Customers** — Clientes (física/jurídica), RUC/CI, cuentas corrientes, límites de crédito
- **Purchases** — Órdenes de compra, recepciones, proveedores, actualización de stock
- **Payments** — Split payments, wallet, crédito rotativo, financiamiento en cuotas
- **SIFEN** — e-Kuatia, CDC, timbrados, envío XML a SET
- **Currency** — Tipos de cambio BCP, multi-moneda (PYG/USD/BRL)
- **Reports** — Ventas, inventario, libros fiscales, financiero
- **Integrations** — Webhooks para InteliCont, InteliAudit, SueldOK

## Fiscal (Paraguay)

- IVA: 10%, 5%, 0% (exento)
- CDC: 44 dígitos (SHA256)
- e-Kuatia: XML con firma digital
- Timbrado: gestión de rangos y vencimientos
- RUC: validación de formato

## Estructura

```
├── api/src/
│   ├── auth/          # JWT, MFA
│   ├── tenants/       # Multi-tenant provisioning
│   ├── companies/     # Empresas y sucursales
│   ├── products/      # Productos y categorías
│   ├── inventory/     # Stock y almacenes
│   ├── sales/         # Ventas y cotizaciones
│   ├── customers/     # Clientes
│   ├── purchases/     # Compras
│   ├── payments/      # Pagos y cobros
│   ├── sifen/         # Facturación electrónica
│   ├── currency/      # Tipos de cambio
│   ├── reports/       # Reportes
│   └── integrations/  # Webhooks ecosystem
├── ui-web/src/
│   ├── pages/         # Páginas principales
│   ├── components/    # Componentes reutilizables
│   └── context/       # Auth y Theme
├── db/
│   └── schema.sql     # Schema maestro
├── docs/              # Documentación técnica
└── docker-compose.yml
```

## License

MIT
