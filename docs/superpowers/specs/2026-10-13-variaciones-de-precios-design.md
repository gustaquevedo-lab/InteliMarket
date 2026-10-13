# Especificación de Diseño: Pestaña de Variaciones de Precios & Auditoría

**Fecha:** 2026-10-13  
**Estado:** Aprobado para Planificación  
**Módulo:** Listas de Precios (`/price-lists`)  
**Contexto del Negocio:** Extra Supermercado Mayorista (Grupo Santa Teresa E.A.S. - RUC 80150377-9 - Asunción, Paraguay)

---

## 1. Resumen Ejecutivo y Objetivos

El sistema requiere una pestaña dedicada dentro del módulo **Listas de Precios**, denominada **"Variaciones de Precios"**, orientada a:
1. **Capturar de forma 100% infalible y atómica** todas las modificaciones de precios regulares que se realicen en el supermercado, abarcando:
   - **Precios Unitarios** regulares (`products.precio_venta`).
   - **Precios de Escala** por volumen mayorista (`sp_tiered_prices.precio_unitario`).
   - **Exclusión explícita de promociones**: No registrar ofertas temporales, combos ni descuentos de feria (estas residen de forma aislada en `promotions` / `sp_promotions` y no alteran los precios regulares).
2. **Consultar y filtrar en tiempo real** mediante:
   - Rango de fechas (`fecha_desde`, `fecha_hasta`) evaluado estrictamente en zona horaria local `America/Asuncion` (UTC-4 / UTC-3).
   - Tipo de variación (Todos, Solo Unitarios, Solo Escalas).
   - Búsqueda por texto (nombre de producto, SKU o código de barras).
   - Ordenamiento configurable (Fecha más reciente primero, Fecha más antigua primero, Nombre A-Z, Nombre Z-A).
3. **Generar y descargar reportes oficiales**:
   - **Exportación en Excel / CSV**: Para auditoría de costos y análisis en hojas de cálculo.
   - **Reporte PDF Oficial**: Formato limpio, paginado, con membrete oficial de Extra Supermercado Mayorista, datos fiscales y totales de variación.

---

## 2. Arquitectura de Datos y Base de Datos (PostgreSQL)

### 2.1. Tabla `price_variation_logs`

Se crea la tabla `price_variation_logs` mediante migración de Alembic:

| Columna | Tipo | Restricción / Notas |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `DEFAULT gen_random_uuid()` |
| `company_id` | `UUID` | Not Null, FK `companies(id)` |
| `product_id` | `UUID` | Not Null, FK `products(id)` ON DELETE CASCADE |
| `product_nombre` | `VARCHAR(255)` | Desnormalizado al momento del cambio |
| `product_sku` | `VARCHAR(100)` | Nullable |
| `product_barcode` | `VARCHAR(100)` | Nullable |
| `categoria_nombre`| `VARCHAR(150)` | Nullable, para filtrado rápido |
| `tipo` | `VARCHAR(20)` | Not Null: `'unitario'` o `'escala'` |
| `escala_min_qty` | `INTEGER` | `NULL` si `tipo = 'unitario'`, entero ($\ge 2$) si `tipo = 'escala'` |
| `precio_anterior`| `NUMERIC(15, 2)`| Not Null, en Guaraníes (PYG) |
| `precio_nuevo` | `NUMERIC(15, 2)`| Not Null, en Guaraníes (PYG) |
| `diferencia_monto`| `NUMERIC(15, 2)`| `precio_nuevo - precio_anterior` |
| `diferencia_pct` | `NUMERIC(7, 2)` | `((precio_nuevo - precio_anterior) / precio_anterior) * 100` |
| `origen` | `VARCHAR(50)` | `'catalogo'`, `'editor_margen'`, `'escala'`, `'sales_agent'`, `'importacion'`, `'trigger'` |
| `usuario_id` | `UUID` | Nullable, FK `users(id)` |
| `usuario_nombre` | `VARCHAR(150)` | Nullable ('Administrador', 'Gerente Ventas', etc.) |
| `motivo` | `TEXT` | Nullable |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()`, indexado |

#### Índices de Rendimiento:
- `ix_price_variation_cid_date`: `(company_id, created_at DESC)`
- `ix_price_variation_pid`: `(product_id)`
- `ix_price_variation_tipo`: `(company_id, tipo)`

---

### 2.2. Triggers Automáticos en PostgreSQL

Para garantizar captura total sin depender de endpoints específicos:

1. **Trigger de Precio Unitario (`tg_log_product_price_variation`)**:
   - Evento: `AFTER UPDATE ON products`.
   - Condición: `OLD.precio_venta IS DISTINCT FROM NEW.precio_venta AND NEW.precio_venta IS NOT NULL`.
   - Acción: Inserta automáticamente en `price_variation_logs` con `tipo = 'unitario'`, extrayendo el nombre, SKU, código de barras y categoría del producto.

2. **Trigger de Precios de Escala (`tg_log_tiered_price_variation`)**:
   - Evento: `AFTER INSERT OR UPDATE OR DELETE ON sp_tiered_prices`.
   - Condición:
     - En `UPDATE`: `OLD.precio_unitario IS DISTINCT FROM NEW.precio_unitario`.
     - En `INSERT`: Nuevo escalón agregado (`precio_anterior = 0` o precio base unitario del producto).
     - En `DELETE`: Escalón eliminado (`precio_nuevo = 0`).
   - Acción: Inserta en `price_variation_logs` con `tipo = 'escala'`, registrando `escala_min_qty = NEW.min_qty`.

3. **Migración Inicial de Retroactividad**:
   - La migración de Alembic inicializa `price_variation_logs` incorporando los registros históricos ya existentes en `price_audit_log` para no perder la bitácora anterior.

---

## 3. Especificación de Endpoints Backend (FastAPI)

Los endpoints se alojan en el módulo `api/src/price_lists/router.py`:

### 3.1. `GET /api/v1/price-lists/variations`
Consulta paginada con métricas agregadas para la interfaz web.

**Query Parameters:**
- `fecha_desde`: `Optional[str]` (formato `YYYY-MM-DD`, interpretado en `America/Asuncion`).
- `fecha_hasta`: `Optional[str]` (formato `YYYY-MM-DD`, interpretado en `America/Asuncion`).
- `tipo`: `Optional[str]` (`"todos"` | `"unitario"` | `"escala"`, default: `"todos"`).
- `search`: `Optional[str]` (búsqueda por nombre, código de barra o SKU).
- `order_by`: `str` (`"fecha_desc"` | `"fecha_asc"` | `"nombre_asc"` | `"nombre_desc"`, default: `"fecha_desc"`).
- `page`: `int` (default: 1).
- `page_size`: `int` (default: 25).

**Respuesta JSON:**
```json
{
  "resumen": {
    "total_modificaciones": 142,
    "total_subidas": 98,
    "total_bajadas": 44,
    "promedio_variacion_pct": 4.2
  },
  "paginacion": {
    "total": 142,
    "page": 1,
    "page_size": 25,
    "total_pages": 6
  },
  "items": [
    {
      "id": "uuid",
      "fecha": "2026-10-13T10:15:00-03:00",
      "product_id": "uuid",
      "product_nombre": "Coca Cola 2L Descartable",
      "product_sku": "BEB-0012",
      "product_barcode": "784000123456",
      "categoria_nombre": "Bebidas",
      "tipo": "unitario",
      "escala_min_qty": null,
      "precio_anterior": 12000,
      "precio_nuevo": 13000,
      "diferencia_monto": 1000,
      "diferencia_pct": 8.33,
      "origen": "catalogo",
      "usuario_nombre": "Administrador"
    }
  ]
}
```

### 3.2. `GET /api/v1/price-lists/variations/export/csv`
Descarga directa de archivo `variaciones_precios_YYYY-MM-DD.csv` con codificación UTF-8 BOM para apertura perfecta en Excel, con columnas:
`Fecha y Hora, SKU, Código de Barras, Producto, Categoría, Tipo de Precio, Cant. Mínima Escala, Precio Anterior (Gs.), Precio Nuevo (Gs.), Variación Gs., Variación %, Responsable/Origen`.

### 3.3. `GET /api/v1/price-lists/variations/export/pdf`
Generación de PDF formal con membrete de Extra Supermercado:
- Membrete: Razón Social `GRUPO SANTA TERESA E.A.S.`, RUC `80150377-9`, Nombre Fantasía `Extra Supermercado Mayorista`.
- Título: **REPORTE OFICIAL DE VARIACIONES DE PRECIOS REGULARES**.
- Período auditado con fecha y hora local `America/Asuncion`.
- Cuadro resumen de métricas (Total SKUs afectados, aumentos, rebajas, variación neta).
- Tabla cronológica detallada con numeración de página.

---

## 4. Diseño de la Interfaz de Usuario (Frontend: `ui-web/src/pages/price-lists/`)

### 4.1. Incorporación de Pestaña
En `PriceListsPage.tsx`:
- Se agrega el tab a `TABS`:
  `{ key: "variaciones", label: "Variaciones de Precios", icon: TrendingUp }`
- Componente dedicado: `PriceVariationsTab.tsx`.

### 4.2. Componentes Visuales del Tab
1. **Fila Superior de Controles**:
   - Selector de fecha rápido en botones tipo pill: *Hoy*, *Ayer*, *Últimos 7 días*, *Este Mes*, *Personalizado*.
   - Rango de fechas con selector de calendario.
   - Filtro de Tipo: Segmented control (`Todos`, `Unitarios`, `Escalas`).
   - Selector de Orden: Dropdown con opciones:
     - 🕒 *Fecha (Más reciente primero)*
     - 🕒 *Fecha (Más antiguo primero)*
     - 🔤 *Producto (A - Z)*
     - 🔤 *Producto (Z - A)*
   - Buscador en tiempo real por texto.
2. **Barra de Acciones**:
   - Botón `Exportar Excel (CSV)` con icono `FileSpreadsheet`.
   - Botón `Descargar Reporte PDF` con icono `FileText`.
3. **Deck de KPIs Ejecutivos**:
   - Tarjeta 1: Total Modificaciones en período.
   - Tarjeta 2: Precios al Alza (🔺 cantidad y variación media).
   - Tarjeta 3: Precios a la Baja (🔻 cantidad y descuento medio).
   - Tarjeta 4: Variación Promedio Global.
4. **Tabla de Datos**:
   - Estilizada con el diseño oscuro de alto contraste del sistema.
   - Badge distintivo para tipo:
     - Unitario: Badge azul `Unitario`.
     - Escala: Badge violeta `Escala (≥ X un.)`.
   - Importes formateados estrictamente con `formatPYG()`.
   - Columna de variación con etiqueta pill de color (Rojo para subidas, Verde para rebajas) y valor absoluto en Gs.
   - Paginación ágil y mensaje de estado vacío elegante si no hubo cambios en el período seleccionado.

---

## 5. Reglas de Negocio y Restricciones Específicas
1. **No tocar POS ni Electron**: Toda la implementación se circunscribe a `api/src/price_lists/` y `ui-web/src/pages/price-lists/`.
2. **Zona Horaria Paraguay**: Todo procesamiento de fechas se realiza en `America/Asuncion`.
3. **Formato Monetario**: Se utiliza `formatPYG()` sin decimales con punto de miles.
4. **Exclusión de Promociones**: Los triggers de base de datos y consultas ignoran por completo las tablas de ofertas (`promotions`, `sp_promotions`), garantizando que solo se monitoreen listas y precios regulares.

---

## 6. Verificación y Criterios de Aceptación
1. **Prueba de Triggers**:
   - Modificar el precio de un producto en `products` $\rightarrow$ Verificar que se cree de inmediato la fila en `price_variation_logs`.
   - Modificar una escala en `sp_tiered_prices` $\rightarrow$ Verificar registro con tipo `'escala'` y su `escala_min_qty`.
2. **Prueba de Filtros y Orden**:
   - Filtrar por fechas, verificar que no haya desfase por UTC.
   - Ordenar por fecha y por nombre de producto en ambos sentidos.
3. **Prueba de Reportes**:
   - Descargar Excel y validar columnas y formato de números.
   - Descargar PDF y verificar membrete fiscal y estética formal.
