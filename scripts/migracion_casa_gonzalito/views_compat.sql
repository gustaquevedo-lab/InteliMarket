-- Vistas de compatibilidad: mapean los nombres en español que usan algunos
-- módulos viejos de Intelimarket (reports, etc.) a las tablas reales en inglés
-- del esquema actual. NO tocan el código de la app; solo agregan vistas de lectura.
-- Seguro para ejecutar en el piloto Casa Gonzalito (no afecta a las sesiones paralelas).

CREATE OR REPLACE VIEW ventas AS
SELECT
    id,
    company_id,
    branch_id,
    customer_id                 AS cliente_id,
    numero,
    fecha,
    total                       AS monto_total,
    iva_10                      AS monto_iva_10,
    iva_5                       AS monto_iva_5,
    base_gravada_10             AS monto_base_iva_10,
    base_gravada_5              AS monto_base_iva_5,
    base_exenta                 AS monto_exento,
    NULL::varchar               AS condicion_iva,
    (estado = 'cancelado')      AS anulado
FROM sales;

CREATE OR REPLACE VIEW ventas_items AS
SELECT
    id,
    sale_id                     AS venta_id,
    product_id                  AS producto_id,
    cantidad,
    total                       AS precio_total,
    costo_unitario
FROM sale_items;

CREATE OR REPLACE VIEW productos AS
SELECT
    id,
    company_id,
    category_id                 AS categoria_id,
    sku,
    nombre,
    stock_minimo
FROM products;

CREATE OR REPLACE VIEW categorias AS
SELECT id, company_id, nombre, codigo
FROM product_categories;

CREATE OR REPLACE VIEW clientes AS
SELECT
    id,
    company_id,
    razon_social,
    COALESCE(nombre_fantasia, razon_social) AS nombre,
    ruc
FROM customers;
