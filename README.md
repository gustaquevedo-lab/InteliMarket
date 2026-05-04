# InteliMarket

**SaaS ERP verticalizable para comercios y distribuidores en Paraguay**

Parte del ecosistema **IntelliHouse Soluciones** — integrándose con InteliCont (contabilidad), InteliAudit (auditoría impositiva), y SueldOK (recursos humanos).

[![Status](https://img.shields.io/badge/status-planning-blue)]()
[![Python](https://img.shields.io/badge/python-3.12+-blue.svg)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)]()
[![React](https://img.shields.io/badge/React-18-blue.svg)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)]()

---

## Features

- **Facturación electrónica SIFEN** — e-Kuatia nativo con CDC automático
- **POS offline-first** — PWA que funciona sin internet
- **Inventario completo** — Multi-almacén, FIFO/promedio, lotes, series
- **Multimoneda** — PYG, USD + configurables con tasas BCP
- **Cobros flexibles** — Efectivo, tarjetas, transferencia, cheques, wallet, crédito, financiamiento
- **Pasarelas Paraguay** — Pagopar, Kuapay
- **Compliance DNIT** — Libros IVA, RG 90, retenciones automáticas
- **Ecosistema integrado** — InteliCont, InteliAudit, SueldOK

## Verticales

| Vertical | Estado | Descripción |
|----------|--------|-------------|
| Retail / Tiendas | MVP | POS, inventario, facturación, caja |
| Distribución / Mayorista | MVP | Compras, pedidos, rutas, CRM B2B |
| Restaurantes | Roadmap | Mesas, comandas, recetas, delivery |
| Servicios | Roadmap | Turnos, proyectos, horas facturables |
| Manufactura | Roadmap | BOM, producción, materia prima |

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy, Celery, Redis
- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Zustand
- **Database:** PostgreSQL 16 (schema por tenant)
- **Infra:** Docker, Nginx

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md) — Diseño técnico completo
- [PRD](docs/PRD.md) — Product Requirements Document
- [Integraciones](docs/INTEGRATIONS.md) — Contratos con ecosistema
- [Reglas fiscales Paraguay](docs/FISCAL_PY_RULES.md) — Compliance
- [Roadmap](docs/ROADMAP.md) — Plan de desarrollo
- [Backlog](docs/BACKLOG.md) — Tareas detalladas

## Inicio rápido

### Backend

```bash
# Crear entorno virtual
python -m venv .venv
source .venv/bin/activate  # o .venv\Scripts\activate en Windows

# Instalar dependencias
pip install -e ".[dev]"

# Configurar variables
cp .env.example .env

# Levantar infraestructura
docker compose up -d postgres redis

# Migrar BD
alembic upgrade head

# Iniciar API
uvicorn api.src.main:app --reload
```

### Frontend

```bash
cd ui-web
npm install
npm run dev
```

## Planes SaaS

| Feature | Starter | Professional | Business | Enterprise |
|---------|---------|-------------|----------|------------|
| Precio mensual (PYG) | 250.000 | 750.000 | 2.000.000 | A convenir |
| Sucursales | 1 | 3 | 10 | ∞ |
| POS | 1 | 3 | 10 | ∞ |
| Facturas/mes | 500 | 5,000 | 50,000 | ∞ |

## Licencia

Copyright © 2026 IntelliHouse Soluciones. Todos los derechos reservados.
