#!/usr/bin/env python3
"""
Validación de la migración (v2): compara legacy MySQL (columbia) con Intelimarket (Postgres).

    uv run python validar.py
"""
import os
import pymysql
import psycopg

MYSQL = dict(
    host=os.getenv("MYSQL_HOST", "127.0.0.1"),
    port=int(os.getenv("MYSQL_PORT", "3306")),
    user=os.getenv("MYSQL_USER", "etl"),
    password=os.getenv("MYSQL_PASSWORD", "etl"),
    database=os.getenv("MYSQL_DB", "columbia"),
    charset="latin1",
)
PG_DSN = os.getenv("PG_DSN", "postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket")


def q1(cur, sql):
    cur.execute(sql)
    r = cur.fetchone()[0]
    return int(r or 0)


def main():
    my = pymysql.connect(**MYSQL)
    pg = psycopg.connect(PG_DSN)
    mc, pc = my.cursor(), pg.cursor()

    print(f"{'Métrica':<34}{'Legacy':>17}{'Intelimarket':>17}   ok")
    print("-" * 86)
    checks = [
        ("Clientes",
         "SELECT COUNT(*) FROM clientes", "SELECT COUNT(*) FROM customers"),
        ("Productos (+1 placeholder)",
         "SELECT COUNT(*) FROM productos", "SELECT COUNT(*)-1 FROM products"),
        ("Proveedores (+1 placeholder)",
         "SELECT COUNT(*) FROM proveedor", "SELECT COUNT(*)-1 FROM suppliers"),
        ("Listas de precio",
         "SELECT 8", "SELECT COUNT(*) FROM price_lists"),
        ("Productos con precio (que existen)",
         "SELECT COUNT(DISTINCT p.CODIGO) FROM precios_ventas p "
         "JOIN productos pr ON pr.CODIGO=p.CODIGO WHERE p.PRECIO1>0 OR p.PRECIO2>0 OR "
         "p.PRECIO3>0 OR p.PRECIO4>0 OR p.PRECIO5>0 OR p.PRECIO6>0 OR p.PRECIO7>0",
         "SELECT COUNT(DISTINCT product_id) FROM price_list_items"),
        ("Ventas (facturas)",
         "SELECT COUNT(*) FROM fac_ventas",
         "SELECT COUNT(*) FROM sales WHERE tipo_comprobante='factura'"),
        ("Facturación bruta (Gs)",
         "SELECT ROUND(SUM(MONTO)) FROM fac_ventas",
         "SELECT ROUND(SUM(total)) FROM sales WHERE tipo_comprobante='factura'"),
        ("Notas de crédito",
         "SELECT COUNT(*) FROM notacredito",
         "SELECT COUNT(*) FROM sales WHERE tipo_comprobante='notacredito'"),
        ("Monto notas de crédito (Gs)",
         "SELECT ROUND(SUM(MONTO)) FROM notacredito",
         "SELECT ROUND(-SUM(total)) FROM sales WHERE tipo_comprobante='notacredito'",
         100),  # tolerancia 100 Gs por redondeo de centavos
        ("Compras (cabecera)",
         "SELECT COUNT(*) FROM fac_compras",
         "SELECT COUNT(*) FROM purchase_orders"),
    ]
    for check in checks:
        label, sql_my, sql_pg = check[0], check[1], check[2]
        tol = check[3] if len(check) > 3 else 0
        a, b = q1(mc, sql_my), q1(pc, sql_pg)
        ok = "✓" if abs(a - b) <= tol else "✗"
        print(f"{label:<34}{a:>17,}{b:>17,}   {ok}")

    # Facturación bruta por año (solo facturas)
    print("\nFacturación BRUTA por año (Gs) — solo facturas:")
    print(f"{'Año':<8}{'Legacy':>19}{'Intelimarket':>19}   ok")
    print("-" * 54)
    mc.execute("SELECT LEFT(FECHA,4) y, ROUND(SUM(MONTO)) FROM fac_ventas "
               "WHERE FECHA>='2000-01-01' GROUP BY y ORDER BY y")
    leg = {str(y): int(v or 0) for y, v in mc.fetchall()}
    pc.execute("SELECT EXTRACT(YEAR FROM fecha)::int y, ROUND(SUM(total)) FROM sales "
               "WHERE tipo_comprobante='factura' GROUP BY y ORDER BY y")
    mig = {str(y): int(v or 0) for y, v in pc.fetchall()}
    for y in sorted(set(leg) | set(mig)):
        a, b = leg.get(y, 0), mig.get(y, 0)
        print(f"{y:<8}{a:>19,}{b:>19,}   {'✓' if a == b else '✗'}")

    # Facturación NETA (informativo)
    neta = q1(pc, "SELECT ROUND(SUM(total)) FROM sales")
    print(f"\nFacturación NETA en Intelimarket (facturas − notas): {neta:,} Gs")

    # Desglose de precios por lista (los "tipos de precio" de la distribuidora)
    print("\nPrecios migrados por lista:")
    pc.execute("SELECT pl.nombre, COUNT(pp.id) FROM price_lists pl "
               "LEFT JOIN price_list_items pp ON pp.price_list_id=pl.id "
               "GROUP BY pl.nombre ORDER BY pl.nombre")
    for nombre, n in pc.fetchall():
        print(f"  {nombre:<20}{n:>10,} productos con precio")

    print("\nClientes por lista de precio asignada:")
    pc.execute("SELECT COALESCE(pl.nombre,'(sin lista)'), COUNT(c.id) FROM customers c "
               "LEFT JOIN price_lists pl ON pl.id=c.price_list_id "
               "GROUP BY pl.nombre ORDER BY 1")
    for nombre, n in pc.fetchall():
        print(f"  {nombre:<20}{n:>10,} clientes")

    my.close()
    pg.close()


if __name__ == "__main__":
    main()
