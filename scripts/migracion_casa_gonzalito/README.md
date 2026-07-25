# Migración Casa Gonzalito → Intelimarket

ETL que migra la base legacy MySQL 5.1 (`columbia`, sistema Jam/Abyss) a Intelimarket (PostgreSQL).
Corre en el **Minisforum**, leyendo la copia local de MySQL y cargando a Postgres con `COPY`.

## Qué migra (v1 — núcleo)

| Legacy | → Intelimarket | Notas |
|---|---|---|
| `categoria` | `product_categories` | |
| `productos` | `products` | precio de venta y desglose de impuesto = v2 |
| `clientes` | `customers` | RUC+DV combinados; `'0'` → NULL |
| `proveedor` | `suppliers` | |
| `deposito` | `warehouses` | + un "Depósito Principal" por defecto |
| `existencia` | `stock` | cantidad por almacén |
| `ctas_a_cobrar` | `customer_accounts` | saldo pendiente agregado por cliente |
| `fac_ventas` | `sales` | `numero` = IDFACVENTAS (único); NUMFAC/timbrado → observaciones |
| `item_ventas` | `sale_items` | IVA (10/5/0) deducido de GRAV10/GRAV5/EXENTAS |

**Llaves:** todos los IDs destino son UUID deterministas (`uuid5`) derivados de las llaves
de negocio del legacy → las relaciones se reconstruyen solas, sin tablas crosswalk.

## Prerrequisitos (una sola vez, en el Minisforum)

**1. Usuario de solo-lectura en el MySQL local** (para que el ETL lea `columbia`):
```bash
sudo mariadb -e "CREATE USER IF NOT EXISTS 'etl'@'localhost' IDENTIFIED BY 'etl'; GRANT SELECT ON columbia.* TO 'etl'@'localhost'; FLUSH PRIVILEGES;"
```

**2. Dependencias Python** (en la carpeta del script):
```bash
cd ~/intelimarket/scripts/migracion_casa_gonzalito
uv init --no-workspace 2>/dev/null; uv add pymysql "psycopg[binary]"
```

## Correr la migración

```bash
cd ~/intelimarket/scripts/migracion_casa_gonzalito
uv run python etl.py --reset
```

- `--reset` **recrea el esquema** (DROP SCHEMA public + aplica `db/schema.sql`) y luego migra.
  Úsalo la primera vez y cada vez que quieras empezar de cero.
- Sin `--reset` asume que el esquema ya está aplicado (solo re-carga; puede chocar con datos
  previos por llaves duplicadas — para re-correr limpio, usá `--reset`).

Es idempotente vía `--reset`: podés correrlo cuantas veces quieras.

## Validar (comparar contra el legacy)

```bash
uv run python validar.py
```

Compara conteos y facturación total legacy vs migrado. Si los números cuadran, la migración
es confiable.

## Config (variables de entorno, opcionales)

| Var | Default |
|---|---|
| `MYSQL_HOST` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DB` | `127.0.0.1` / `etl` / `etl` / `columbia` |
| `PG_DSN` | `postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket` |
| `SCHEMA_SQL` | `~/intelimarket/db/schema.sql` |
| `CG_RUC` | `80012345-6` (poné el RUC real de Casa Gonzalito) |

## Pendiente para v2

- Precio de venta de productos (`precios_ventas` → `product_prices`).
- Mapeo fino de tasa de IVA por producto (tabla `impuesto`).
- Notas de crédito (`notacredito`), compras (`fac_compras`), histórico contable.
- Migrar también las bases `fe` (factura electrónica) y `mastersm`.
