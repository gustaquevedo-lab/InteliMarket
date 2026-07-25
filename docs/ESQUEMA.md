# Esquema de base de datos — fuente de verdad

## Decisión

El esquema de PostgreSQL de Intelimarket se construye **desde los modelos ORM** (SQLAlchemy),
con el script `crear_esquema.py` (raíz del repo), **NO** desde `db/schema.sql` ni desde las
migraciones Alembic.

### Por qué

- **`db/schema.sql` está incompleto** respecto a los modelos: le faltan columnas (p.ej.
  `users.is_superadmin`, costos de productos) y tablas (p.ej. `credit_accounts`) que la app espera.
- **Las migraciones Alembic (`api/alembic/versions`) tienen bugs** y no corren de punta a punta
  (p.ej. `f8a2b3c4d5e6_add_purchase_intelligence_tables.py` usa `op.add_index`, que no existe en
  Alembic — es `op.create_index`).
- **Los modelos ORM son la verdad real de la app**: la app los importa todos al arrancar. Generar
  el esquema con `Base.metadata.create_all()` garantiza que la base coincide exactamente con lo que
  el código consulta.

## Cómo se construye

`crear_esquema.py`:

1. Importa `api.src.main`, que a su vez importa todos los routers → registra los **~450 modelos**
   en `Base.metadata`.
2. `_relax_enums()` — convierte todos los `Enum` a **VARCHAR** (`native_enum=False`,
   `create_constraint=False`). Evita los desajustes nombre/valor de enums mal definidos
   (p.ej. `maintenancestatus` con default `'scheduled'` vs etiqueta `SCHEDULED`). La validación
   de valores sigue ocurriendo en Python vía el tipo `Enum` del modelo.
3. `_dedup_indices()` — quita índices con **nombre duplicado** (columna `index=True` + `Index()`
   explícito con el mismo nombre); PostgreSQL exige nombres únicos.
4. `Base.metadata.create_all()` — materializa las 450 tablas.

### Reconstruir una base desde cero

```bash
# base descartable de prueba
sudo -u postgres psql -c "DROP DATABASE IF EXISTS im_test;"
sudo -u postgres psql -c "CREATE DATABASE im_test OWNER intelimarket;"
cd ~/intelimarket && uv run python crear_esquema.py            # usa im_test por defecto

# base real de producción
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='intelimarket';"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS intelimarket;"
sudo -u postgres psql -c "CREATE DATABASE intelimarket OWNER intelimarket;"
cd ~/intelimarket && TARGET_DSN=postgresql+asyncpg://intelimarket:intelimarket_dev@localhost:5432/intelimarket \
    uv run python crear_esquema.py
```

Luego se cargan los datos con el ETL **sin** `--reset`:
`cd scripts/migracion_casa_gonzalito && uv run python etl.py`

## Bugs de modelos corregidos para que `create_all` funcione

- `api/src/whatsapp/models.py`: `__table_args__` definido dos veces por clase (el dict `{schema:public}`
  lo pisaba una tupla) + FKs con prefijo `public.`. Unificado.
- Quitado `schema="public"` de todos los modelos (auth, tenants, whatsapp, intelientregas/fleet,
  pagopar, backups) para unificar el namespace: las tablas quedan en `public` por defecto y las FKs
  sin prefijo resuelven bien.

> Nota: si en el futuro se retoma Alembic, habrá que regenerar las migraciones desde los modelos
> (`alembic revision --autogenerate`) partiendo de este esquema como baseline, y descartar las
> migraciones viejas rotas.
