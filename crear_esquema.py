#!/usr/bin/env python3
"""
Crea el esquema COMPLETO de Intelimarket directamente desde los modelos ORM
(la fuente de verdad real de la app), evitando:
  - db/schema.sql  → está incompleto (le faltan columnas/tablas)
  - las migraciones Alembic → tienen bugs (p.ej. op.add_index inexistente)

Importa api.src.main, que a su vez importa TODOS los routers → registra TODOS
los modelos en Base.metadata. Luego create_all los materializa.

Uso:
    TARGET_DSN=postgresql+asyncpg://intelimarket:intelimarket_dev@localhost:5432/im_test \
        uv run python crear_esquema.py
"""
import os
import asyncio

import enum
import api.src.main  # noqa: F401  -> registra TODOS los modelos en Base.metadata
from api.src.db import Base
from sqlalchemy import Enum as SAEnum, text
from sqlalchemy.ext.asyncio import create_async_engine

DSN = os.getenv(
    "TARGET_DSN",
    "postgresql+asyncpg://intelimarket:intelimarket_dev@localhost:5432/im_test",
)


def _dedup_indices():
    """Quita índices con nombre duplicado (p.ej. columna index=True + Index() explícito
    con el mismo nombre). Los duplicados son redundantes; PostgreSQL exige nombre único."""
    vistos = set()
    quitados = 0
    for table in Base.metadata.tables.values():
        for idx in list(table.indexes):
            if idx.name in vistos:
                table.indexes.discard(idx)
                quitados += 1
            else:
                vistos.add(idx.name)
    if quitados:
        print(f"  (deduplicados {quitados} índices con nombre repetido)")


def _relax_enums():
    """Trata todos los Enum como VARCHAR simple (sin tipo enum nativo de PG ni CHECK).
    Evita los desajustes nombre/valor de enums mal definidos; la app valida en Python."""
    n = 0
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, SAEnum):
                col.type.native_enum = False
                col.type.create_constraint = False
                n += 1
    if n:
        print(f"  (enums tratados como VARCHAR: {n})")


def _add_server_defaults():
    """Convierte los default de Python (scalar) en server_default reales en la base,
    para columnas NOT NULL sin server_default. Así COPY / inserciones crudas toman el
    valor por defecto (el ORM lo aplicaba en Python, pero COPY no pasa por el ORM)."""
    n = 0
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if col.nullable or col.server_default is not None or col.default is None:
                continue
            val = getattr(col.default, "arg", None)
            if val is None or callable(val):
                continue  # callables (func.now, lambdas, listas) → no se pueden serializar acá
            if isinstance(val, enum.Enum):
                val = val.value
            if isinstance(val, bool):
                col.server_default = text("true" if val else "false")
            elif isinstance(val, (int, float)):
                col.server_default = text(str(val))
            elif isinstance(val, str):
                col.server_default = text("'" + val.replace("'", "''") + "'")
            else:
                continue
            n += 1
    if n:
        print(f"  (server_default agregado a {n} columnas NOT NULL con default Python)")


async def main():
    _relax_enums()
    _add_server_defaults()
    _dedup_indices()
    engine = create_async_engine(DSN)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    destino = DSN.rsplit("@", 1)[-1]
    print(f"✓ Esquema creado: {len(Base.metadata.tables)} tablas en {destino}")


if __name__ == "__main__":
    asyncio.run(main())
