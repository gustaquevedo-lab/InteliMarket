# Fraccionamiento de Productos y Códigos de Barra Alternativos - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar en Producto 360 la gestión integral de códigos de barra alternativos multiorigen (1:1) y packs, junto con el sistema de fraccionamiento y desarme de bultos/displays a unidades de góndola con transferencia atómica de stock en inventario y venta fluida en caja.

**Architecture:** Se reutiliza `product_pack_barcodes` para soportar códigos alternativos 1:1 y packs N:1, y se crea un nuevo módulo `api/src/fractionations/` con la tabla `product_fractionations` para modelar el vínculo padre-hijo (Display ↔ Unidad). Las operaciones de fraccionamiento ejecutan una transacción atómica de stock que decrementa displays e incrementa unidades preservando el valor total de inventario, integrando en Producto 360 una pestaña unificada de "Códigos & Presentaciones".

**Architecture Diagram:**

```mermaid
graph TD
    subgraph "Frontend: Producto 360"
        UI_Tab[Pestaña: Códigos & Presentaciones]
        UI_Alt[Gestor Códigos Alternativos 1:1 y Packs]
        UI_Frac[Gestor Fraccionamiento & Modal Apertura Bulto]
        UI_Tab --> UI_Alt
        UI_Tab --> UI_Frac
    end

    subgraph "Backend: FastAPI Cluster"
        Router_Pack[Router /v1/pack-barcodes]
        Router_Frac[Router /v1/products/{id}/fractionation]
        Service_Frac[Service Fractionation: Link, CreateChild, ExecuteStock]
        Service_Prod[Product Service: get_product_by_barcode]
    end

    subgraph "PostgreSQL"
        T_Pack[product_pack_barcodes]
        T_Frac[product_fractionations]
        T_Prod[products]
        T_Stock[stock & stock_movements]
    end

    UI_Alt --> Router_Pack
    UI_Frac --> Router_Frac
    Router_Frac --> Service_Frac
    Service_Frac --> T_Frac
    Service_Frac --> T_Prod
    Service_Frac --> T_Stock
    Router_Pack --> T_Pack
    Service_Prod --> T_Pack
    Service_Prod --> T_Prod
```

**Tech Stack:** Python 3.14 / FastAPI / SQLAlchemy Async / PostgreSQL / React 18 / TypeScript / Vite / Tailwind CSS / Lucide Icons.

**Spec:** [docs/superpowers/specs/2026-10-14-fraccionamiento-y-codigos-alternativos-design.md](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/docs/superpowers/specs/2026-10-14-fraccionamiento-y-codigos-alternativos-design.md)

## Global Constraints
- **Vertical:** Exclusivamente Supermercado (`vertical/supermercado`), VM `intellihouse@100.83.91.76`.
- **Blindaje POS/Electron:** Queda terminantemente PROHIBIDO modificar o tocar archivos dentro de `ui-web/src/pages/pos/` o `electron/`.
- **Formato Monetario:** Uso obligatorio del componente canónico `<CurrencyInput />` en inputs monetarios y `formatPYG()` para renderizado en pantalla (Regla 10).
- **Zona Horaria:** `America/Asuncion` para fechas y timestamps de movimientos.
- **Despliegues:** Cero tiempo de inactividad (`bash deploy-api.sh` y `bash deploy-ui.sh`).

---

### Task 1: Migración de Base de Datos y Modelo de Fraccionamiento

**Files:**
- Create: `api/alembic/versions/20261014160000_add_product_fractionations.py`
- Create: `api/src/fractionations/models.py`
- Create: `api/src/fractionations/schemas.py`
- Create: `api/src/fractionations/__init__.py`

**Interfaces:**
- Produces: Modelo SQLAlchemy `ProductFractionation` con campos `id`, `company_id`, `parent_product_id`, `child_product_id`, `factor_conversion`, `activo`.
- Produces: Schemas Pydantic `FractionationLinkInput`, `FractionationQuickCreateChildInput`, `FractionationExecuteStockInput`, `FractionationResponse`.

- [ ] **Step 1: Crear archivo de migración Alembic para la tabla `product_fractionations`**

```python
"""Add product_fractionations table

Revision ID: 20261014160000
Revises: 20261013173000
Create Date: 2026-10-14 16:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261014160000"
down_revision = "20261013173000"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "product_fractionations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("parent_product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("factor_conversion", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("parent_product_id", name="uq_fractionation_parent"),
        sa.UniqueConstraint("child_product_id", name="uq_fractionation_child"),
        sa.CheckConstraint("factor_conversion > 1", name="chk_fractionation_factor"),
        sa.CheckConstraint("parent_product_id <> child_product_id", name="chk_fractionation_diff"),
    )
    op.create_index("ix_product_fractionations_parent", "product_fractionations", ["parent_product_id"])
    op.create_index("ix_product_fractionations_child", "product_fractionations", ["child_product_id"])

def downgrade() -> None:
    op.drop_table("product_fractionations")
```

- [ ] **Step 2: Crear modelos y schemas Pydantic en `api/src/fractionations/`**

Crear `api/src/fractionations/models.py`:
```python
from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base

class ProductFractionation(Base):
    __tablename__ = "product_fractionations"
    __table_args__ = (
        UniqueConstraint("parent_product_id", name="uq_fractionation_parent"),
        UniqueConstraint("child_product_id", name="uq_fractionation_child"),
        CheckConstraint("factor_conversion > 1", name="chk_fractionation_factor"),
        CheckConstraint("parent_product_id <> child_product_id", name="chk_fractionation_diff"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    parent_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    child_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    factor_conversion = Column(Integer, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    parent_product = relationship("Product", foreign_keys=[parent_product_id])
    child_product = relationship("Product", foreign_keys=[child_product_id])
```

Crear `api/src/fractionations/schemas.py`:
```python
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class FractionationLinkInput(BaseModel):
    child_product_id: UUID
    factor_conversion: int = Field(gt=1, description="Unidades contenidas en 1 display")

class FractionationQuickCreateChildInput(BaseModel):
    codigo_barra: str = Field(min_length=1)
    nombre: str = Field(min_length=2)
    precio_venta: float = Field(gt=0)
    factor_conversion: int = Field(gt=1)

class FractionationExecuteStockInput(BaseModel):
    cantidad_displays: int = Field(gt=0)
    motivo: Optional[str] = "Apertura de display para venta unitaria en góndola"

class FractionationInfoResponse(BaseModel):
    is_display: bool
    is_child: bool
    relationship_id: Optional[UUID] = None
    factor_conversion: Optional[int] = None
    parent_product: Optional[dict] = None
    child_product: Optional[dict] = None
```

- [ ] **Step 3: Aplicar migración de Alembic en entorno local/test**
Run: `alembic upgrade head`
Expected: Migración aplicada exitosamente.

- [ ] **Step 4: Commit**
```bash
git add api/alembic/versions/20261014160000_add_product_fractionations.py api/src/fractionations/
git commit -m "feat(fractionations): agregar migracion y modelos de fraccionamiento de productos"
```

---

### Task 2: Servicio y Lógica de Negocio de Fraccionamiento e Inventario

**Files:**
- Create: `api/src/fractionations/service.py`
- Modify: `api/src/products/service.py` (enriquecer `get_product_360_view` y `get_product_by_barcode`)

**Interfaces:**
- Produces: `get_fractionation_for_product(db, company_id, product_id)`
- Produces: `link_fractionation(db, company_id, parent_id, data)`
- Produces: `quick_create_child_and_link(db, company_id, user_id, parent_id, data)`
- Produces: `execute_stock_fractionation(db, company_id, user_id, user_name, parent_id, data)`
- Produces: `unlink_fractionation(db, company_id, product_id)`

- [ ] **Step 1: Implementar `api/src/fractionations/service.py`**

```python
"""Fractionations service -- gestiona relacion Display <-> Unidad y desarmes de stock."""
import uuid
from decimal import Decimal
from sqlalchemy import select, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from api.src.fractionations.models import ProductFractionation
from api.src.fractionations.schemas import (
    FractionationLinkInput, FractionationQuickCreateChildInput, FractionationExecuteStockInput
)
from api.src.products.models import Product

async def get_fractionation_for_product(db: AsyncSession, company_id: str, product_id: str) -> dict:
    c_uuid = uuid.UUID(company_id)
    p_uuid = uuid.UUID(product_id)

    # 1. ¿Es un display padre?
    stmt_parent = select(ProductFractionation).where(
        ProductFractionation.company_id == c_uuid,
        ProductFractionation.parent_product_id == p_uuid,
        ProductFractionation.activo == True
    )
    res_parent = (await db.execute(stmt_parent)).scalar_one_or_none()
    if res_parent:
        child_res = await db.execute(
            text("""
                SELECT p.id, p.nombre, p.sku, p.codigo_barra, p.precio_venta,
                       COALESCE(s.cantidad, 0) as stock_actual
                FROM products p
                LEFT JOIN stock s ON s.product_id = p.id
                WHERE p.id = :cid
            """),
            {"cid": res_parent.child_product_id}
        )
        child = child_res.mappings().first()
        return {
            "is_display": True,
            "is_child": False,
            "relationship_id": res_parent.id,
            "factor_conversion": res_parent.factor_conversion,
            "child_product": dict(child) if child else None,
            "parent_product": None,
        }

    # 2. ¿Es una unidad hija?
    stmt_child = select(ProductFractionation).where(
        ProductFractionation.company_id == c_uuid,
        ProductFractionation.child_product_id == p_uuid,
        ProductFractionation.activo == True
    )
    res_child = (await db.execute(stmt_child)).scalar_one_or_none()
    if res_child:
        parent_res = await db.execute(
            text("""
                SELECT p.id, p.nombre, p.sku, p.codigo_barra, p.precio_venta,
                       COALESCE(s.cantidad, 0) as stock_actual
                FROM products p
                LEFT JOIN stock s ON s.product_id = p.id
                WHERE p.id = :pid
            """),
            {"pid": res_child.parent_product_id}
        )
        parent = parent_res.mappings().first()
        return {
            "is_display": False,
            "is_child": True,
            "relationship_id": res_child.id,
            "factor_conversion": res_child.factor_conversion,
            "parent_product": dict(parent) if parent else None,
            "child_product": None,
        }

    return {"is_display": False, "is_child": False}
```

- [ ] **Step 2: Implementar vinculación, creación rápida y ejecución atómica de stock**

```python
async def execute_stock_fractionation(
    db: AsyncSession, company_id: str, user_id: str | None, user_name: str | None, parent_id: str, data: FractionationExecuteStockInput
) -> dict:
    c_uuid = uuid.UUID(company_id)
    p_uuid = uuid.UUID(parent_id)

    stmt = select(ProductFractionation).where(
        ProductFractionation.company_id == c_uuid,
        ProductFractionation.parent_product_id == p_uuid,
        ProductFractionation.activo == True
    )
    frac = (await db.execute(stmt)).scalar_one_or_none()
    if not frac:
        raise HTTPException(status_code=400, detail="Este producto no tiene configurado un fraccionamiento activo.")

    # Verificar stock disponible del display
    stock_parent_res = await db.execute(
        text("SELECT cantidad FROM stock WHERE product_id = :pid"), {"pid": p_uuid}
    )
    stock_parent = stock_parent_res.scalar() or Decimal("0")
    if stock_parent < data.cantidad_displays:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente de displays. Hay {int(stock_parent)} cajas disponibles e intentas fraccionar {data.cantidad_displays}."
        )

    unidades_a_ingresar = data.cantidad_displays * frac.factor_conversion

    # 1. Decrementar stock display
    await db.execute(
        text("UPDATE stock SET cantidad = cantidad - :qty, updated_at = NOW() WHERE product_id = :pid"),
        {"qty": data.cantidad_displays, "pid": p_uuid}
    )
    # Registrar movimiento kardex salida
    await db.execute(
        text("""
            INSERT INTO stock_movements (
                company_id, product_id, tipo_movimiento, cantidad, motivo, referencia_id, created_at
            ) VALUES (
                :cid, :pid, 'fraccionamiento_salida', :qty, :motivo, :ref_id, NOW()
            )
        """),
        {
            "cid": c_uuid,
            "pid": p_uuid,
            "qty": -data.cantidad_displays,
            "motivo": data.motivo or "Desarme de display a góndola",
            "ref_id": frac.child_product_id,
        }
    )

    # 2. Incrementar stock unidad
    # Asegurar que exista fila de stock para la unidad
    await db.execute(
        text("""
            INSERT INTO stock (company_id, product_id, cantidad, updated_at)
            VALUES (:cid, :chid, :qty, NOW())
            ON CONFLICT (product_id) DO UPDATE
            SET cantidad = stock.cantidad + :qty, updated_at = NOW()
        """),
        {"cid": c_uuid, "chid": frac.child_product_id, "qty": unidades_a_ingresar}
    )
    # Registrar movimiento kardex entrada
    await db.execute(
        text("""
            INSERT INTO stock_movements (
                company_id, product_id, tipo_movimiento, cantidad, motivo, referencia_id, created_at
            ) VALUES (
                :cid, :chid, 'fraccionamiento_entrada', :qty, :motivo, :ref_id, NOW()
            )
        """),
        {
            "cid": c_uuid,
            "chid": frac.child_product_id,
            "qty": unidades_a_ingresar,
            "motivo": f"Ingreso por fraccionamiento de {data.cantidad_displays} displays (x{frac.factor_conversion})",
            "ref_id": p_uuid,
        }
    )

    await db.commit()

    return {
        "success": True,
        "displays_descontados": data.cantidad_displays,
        "unidades_ingresadas": unidades_a_ingresar,
        "factor_conversion": frac.factor_conversion,
    }
```

- [ ] **Step 3: Actualizar `get_product_360_view` en [api/src/products/service.py](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/products/service.py)**
Incluir la llamada a `get_fractionation_for_product` y retornarlo dentro del payload del 360 como `fractionation_info`.

- [ ] **Step 4: Commit**
```bash
git add api/src/fractionations/service.py api/src/products/service.py
git commit -m "feat(fractionations): logica de negocio y transacciones de stock para fraccionamiento"
```

---

### Task 3: Endpoints REST para Códigos Alternativos y Fraccionamiento

**Files:**
- Create: `api/src/fractionations/router.py`
- Modify: `api/src/pack_barcodes/router.py` (permitir CRUD completo y endpoints por producto)
- Modify: `api/src/main.py` (registrar router)

**Interfaces:**
- Produces: Router FastAPI `/v1/products/{id}/fractionation` montado con endpoints de consulta, vinculación, alta rápida y fraccionamiento de stock.
- Produces: Router FastAPI `/v1/products/{id}/pack-barcodes` para gestión directa de códigos alternativos desde Producto 360.

- [ ] **Step 1: Crear `api/src/fractionations/router.py`**
Implementar los endpoints definidos en el spec con autenticación requerida (`require_auth`) y dependencias de sesión de base de datos (`get_db`).

- [ ] **Step 2: Enriquecer `api/src/pack_barcodes/router.py`**
Añadir endpoints para:
- `POST /v1/products/{product_id}/pack-barcodes`
- `PATCH /v1/products/{product_id}/pack-barcodes/{pack_id}`
- `DELETE /v1/products/{product_id}/pack-barcodes/{pack_id}`

- [ ] **Step 3: Registrar el router en [api/src/main.py](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/main.py)**

- [ ] **Step 4: Commit**
```bash
git add api/src/fractionations/router.py api/src/pack_barcodes/router.py api/src/main.py
git commit -m "feat(api): registrar routers y endpoints de fraccionamiento y codigos de pack"
```

---

### Task 4: Integración en Frontend (API Client y Pestaña Códigos & Presentaciones)

**Files:**
- Modify: `ui-web/src/api/index.ts`
- Modify: `ui-web/src/pages/products/Product360Modal.tsx`

**Interfaces:**
- Consumes: Endpoints `/v1/products/{id}/fractionation` y `/v1/products/{id}/pack-barcodes`.
- Produces: Pestaña unificada en Producto 360 con:
  - Gestor de Códigos Alternativos y Packs (Agregar código, seleccionar si es 1:1 o Pack xN, editar y eliminar).
  - Gestor de Fraccionamiento (Display ↔ Unidad) con modal de acción rápida para desarmar displays y transferir stock en vivo.

- [ ] **Step 1: Añadir métodos y tipos en `ui-web/src/api/index.ts`**
Agregar cliente de API:
```typescript
fractionations: {
  get: (productId: string) => client.get<FractionationInfo>(`/v1/products/${productId}/fractionation`),
  link: (productId: string, data: { child_product_id: string; factor_conversion: number }) =>
    client.post(`/v1/products/${productId}/fractionation/link`, data),
  quickCreate: (productId: string, data: { codigo_barra: string; nombre: string; precio_venta: number; factor_conversion: number }) =>
    client.post(`/v1/products/${productId}/fractionation/quick-create-child`, data),
  executeStock: (productId: string, data: { cantidad_displays: number; motivo?: string }) =>
    client.post(`/v1/products/${productId}/fractionation/execute-stock`, data),
  unlink: (productId: string) => client.delete(`/v1/products/${productId}/fractionation`),
},
packBarcodes: {
  create: (productId: string, data: { codigo_barra: string; etiqueta: string; unidades_por_paquete: number }) =>
    client.post(`/v1/products/${productId}/pack-barcodes`, data),
  delete: (productId: string, packId: string) => client.delete(`/v1/products/${productId}/pack-barcodes/${packId}`),
}
```

- [ ] **Step 2: Rediseñar la pestaña `codigos` en `Product360Modal.tsx`**
Reemplazar la vista de solo lectura por la interfaz completa de **Códigos & Presentaciones**:
1. Tarjeta 1: Código EAN Principal + PLU Balanza.
2. Tarjeta 2: Códigos Alternativos 1:1 (Brasil/Argentina) y Packs con botón `+ Agregar Código Alternativo`.
3. Tarjeta 3: Fraccionamiento de Display a Góndola:
   - Visualización de la equivalencia `1 Display = X Unidades`.
   - Comparador de stock Display vs Góndola.
   - Botón `⚡ Fraccionar Displays a Góndola` con modal interactivo y CurrencyInput PYG.
   - Soporte para desvincular o dar de alta unidad fraccionada.

- [ ] **Step 3: Compilar y validar TypeScript en `ui-web`**
Run: `cd ui-web && npm run build`
Expected: 0 errores de compilación TypeScript.

- [ ] **Step 4: Commit**
```bash
git add ui-web/src/api/index.ts ui-web/src/pages/products/Product360Modal.tsx
git commit -m "feat(ui): interfaz de codigos alternativos y fraccionamiento en Producto 360"
```

---

### Task 5: Validación E2E, Despliegue Zero-Downtime y Verificación en Vivo

**Files:**
- Create: `api/tests/test_fractionations_e2e.py`

**Interfaces:**
- Consumes: Todo el stack backend y frontend desplegado en producción (`100.83.91.76`).
- Produces: Evidencia de prueba de fraccionamiento de stock y escaneo de códigos de barra alternativos.

- [ ] **Step 1: Crear script de prueba automatizada E2E**
Probar:
1. Creación de un código alternativo 1:1 y verificación de que `get_product_by_barcode` lo resuelve inmediatamente.
2. Vinculación de un display con su unidad fraccionada.
3. Ejecución de fraccionamiento de 1 display y comprobación de que el stock del display baja en 1 y la unidad sube en su factor correspondiente.
4. Intento de sobregiro de displays: verificar que rechaza con error 400.

- [ ] **Step 2: Ejecutar el test E2E en la VM**
Run: `ssh intellihouse@100.83.91.76 "cd /home/intellihouse/intelimarket && .venv/bin/pytest api/tests/test_fractionations_e2e.py -v"`
Expected: Todos los tests pasan (PASS).

- [ ] **Step 3: Desplegar en Producción mediante scripts canónicos**
1. Backend: `bash deploy-api.sh` (aplica migraciones de Alembic y rolling reload zero-downtime).
2. Frontend: `bash deploy-ui.sh` (build atómico y conmutación de enlace simbólico).

- [ ] **Step 4: Commit final y reporte al usuario**
```bash
git push origin vertical/supermercado
```
