# Diseño Técnico: Fraccionamiento de Productos y Códigos de Barra Alternativos

**Fecha:** 2026-10-14  
**Vertical:** Supermercado (Extra Supermercado)  
**Estado:** Propuesta Aprobada / Pendiente de Plan de Implementación  
**Autor:** Antigravity (Google DeepMind) & Equipo Extra Supermercado  

---

## 1. Contexto y Objetivos de Negocio

En el rubro supermercadista y de retail en Paraguay, es frecuente que las mercaderías ingresen al depósito y se registren en las facturas de proveedores bajo la modalidad de **bultos o displays cerrados** (por ejemplo: cajas o displays de golosinas, chocolates, galletitas, fardos de bebidas o paquetes mayoristas).

Actualmente:
1. **Fraccionamiento:** Se dio ingreso al stock en displays cerrados (ej. Display de 24 unidades). Sin embargo, para la venta en piso de venta (góndolas y bateas de caja rápida) es imperativo vender tanto el display completo como las golosinas por unidad individual. Al estar el stock registrado en cajas y no disponer de un mecanismo de desarme/fraccionamiento, la venta individual desajusta el inventario o impide cobrar con el código de barras impreso en cada unidad.
2. **Códigos Alternativos Multiorigen (1:1):** Existen productos (como golosinas, artículos de higiene o alimentos) producidos en diferentes plantas o países (ej. Brasil, Argentina, Paraguay) que conviven físicamente en góndola como el mismo artículo, pero tienen diferentes códigos de barra EAN-13 o UPC impresos en su envase. Actualmente se requiere registrar estos códigos sinónimos para que los cajeros y clientes puedan escanear cualquiera de ellos sin generar error de "código no encontrado".

### Objetivos:
- Permitir en **Producto 360** registrar y administrar códigos de barra alternativos (sinónimos 1:1 de origen y packs de N unidades).
- Vincular un **Producto Display (Padre)** con su **Producto Unidad (Hijo)** definiendo el factor de conversión (ej. 1 Display = 24 Unidades).
- Permitir la creación automática o vinculación manual del producto unitario desde Producto 360.
- Ejecutar la operación de **"Fraccionamiento / Desarme de Stock"**: una transacción de inventario atómica que reduce stock en displays y aumenta stock en unidades en base al factor, conservando la valuación monetaria del kardex.
- Mantener compatibilidad total y fluida en la lectura de códigos de barra en el POS y verificador de precios.

---

## 2. Modelo de Datos y Esquema de Base de Datos

### 2.1 Códigos Alternativos y Packs (`product_pack_barcodes`)
Reutilizamos la tabla existente `product_pack_barcodes`:
```sql
CREATE TABLE IF NOT EXISTS product_pack_barcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    codigo_barra VARCHAR(50) NOT NULL,
    etiqueta VARCHAR(60) NOT NULL,
    unidades_por_paquete NUMERIC(10, 3) NOT NULL DEFAULT 1.000,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_pack_barcode_company_codigo UNIQUE (company_id, codigo_barra)
);

CREATE INDEX IF NOT EXISTS ix_product_pack_barcodes_product_id ON product_pack_barcodes(product_id);
CREATE INDEX IF NOT EXISTS ix_product_pack_barcodes_codigo_barra ON product_pack_barcodes(codigo_barra);
```

**Reglas de negocio:**
- Si `unidades_por_paquete = 1.000`: Representa un **código de barra alternativo / sinónimo 1:1** (ej. EAN de Brasil, código importado, etiqueta secundaria).
- Si `unidades_por_paquete > 1.000`: Representa un **pack / bulto** (ej. Pack x6, Fardo x12).
- Validación de unicidad: el código no puede colisionar con el código principal o SKU de otro producto en la empresa, ni con otra variante o pack.

---

### 2.2 Relación de Fraccionamiento Display ↔ Unidad (`product_fractionations`)
Nueva tabla relacional para soportar el vínculo explícito entre el bulto mayorista y su desglose unitario:
```sql
CREATE TABLE IF NOT EXISTS product_fractionations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    parent_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    child_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    factor_conversion INTEGER NOT NULL CHECK (factor_conversion > 1),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_fractionation_parent UNIQUE (parent_product_id),
    CONSTRAINT uq_fractionation_child UNIQUE (child_product_id),
    CONSTRAINT chk_fractionation_diff_products CHECK (parent_product_id <> child_product_id)
);

CREATE INDEX IF NOT EXISTS ix_product_fractionations_parent ON product_fractionations(parent_product_id);
CREATE INDEX IF NOT EXISTS ix_product_fractionations_child ON product_fractionations(child_product_id);
```

**Propiedades de la relación:**
- `parent_product_id`: Representa el Display / Caja / Fardo (ej. Display Bon o Bon 24u).
- `child_product_id`: Representa la Unidad suelta (ej. Bombón Bon o Bon suelto).
- `factor_conversion`: Cantidad de unidades contenidas en 1 display (ej. 24).
- Un display solo puede tener una unidad fraccionada principal, y una unidad solo puede provenir de un display padre activo (evita grafos cíclicos o inconsistencias de stock).

---

## 3. Transacción Atómica de Inventario ("Apertura de Display a Góndola")

Cuando el encargado de salón o repositor abre físicamente bultos para rellenar bateas o góndolas:

### Procedimiento:
1. **Entrada:** `parent_product_id`, `cantidad_displays` (ej: 2 displays).
2. **Validaciones:**
   - Debe existir una relación activa en `product_fractionations`.
   - El stock actual del producto padre (Display) debe ser mayor o igual a `cantidad_displays`.
   - `cantidad_displays` debe ser un entero positivo.
3. **Cálculo de Unidades:**
   - `cantidad_unidades = cantidad_displays * factor_conversion` (ej: `2 * 24 = 48 unidades`).
4. **Actualización de Stock (Transacción Única):**
   - **Salida de Display:**
     - Descuenta `cantidad_displays` en la tabla `stock` para `parent_product_id`.
     - Registra movimiento en `stock_movements`:
       - `tipo_movimiento`: `fraccionamiento_salida`
       - `cantidad`: `-cantidad_displays`
       - `referencia_id`: `child_product_id`
       - `motivo`: `Apertura de display para venta unitaria en góndola`
   - **Entrada de Unidades:**
     - Aumenta `cantidad_unidades` en la tabla `stock` para `child_product_id`.
     - Actualiza o asigna el costo unitario: `costo_unitario = costo_display / factor_conversion`.
     - Registra movimiento en `stock_movements`:
       - `tipo_movimiento`: `fraccionamiento_entrada`
       - `cantidad`: `+cantidad_unidades`
       - `referencia_id`: `parent_product_id`
       - `motivo`: `Ingreso por fraccionamiento de display`
5. **Neutralidad de Valuación del Inventario:**
   - El monto total en guaraníes del inventario se preserva exactamente:
     $$\text{Costo Total Saliente} = \text{cantidad\_displays} \times \text{costo\_display}$$
     $$\text{Costo Total Entrante} = \text{cantidad\_unidades} \times \left(\frac{\text{costo\_display}}{\text{factor\_conversion}}\right)$$
     $$\text{Delta Valuación} = 0 \text{ Gs.}$$

---

## 4. Endpoints del Backend (FastAPI)

### 4.1 Códigos Alternativos y Packs
- `GET /api/v1/products/{product_id}/pack-barcodes`
  - Retorna la lista de códigos secundarios y packs del producto.
- `POST /api/v1/products/{product_id}/pack-barcodes`
  - Body: `{ codigo_barra: str, etiqueta: str, unidades_por_paquete: float }`
  - Valida colisiones contra productos, variantes y otros packs.
- `PATCH /api/v1/products/{product_id}/pack-barcodes/{pack_id}`
  - Edita etiqueta o código de barra.
- `DELETE /api/v1/products/{product_id}/pack-barcodes/{pack_id}`
  - Elimina el código alternativo.

### 4.2 Fraccionamiento y Relaciones
- `GET /api/v1/products/{product_id}/fractionation`
  - Retorna la información de fraccionamiento del producto:
    - Si es **Display**: retorna los datos de la unidad hija enlazada, factor de conversión, stock disponible de cajas y stock disponible de unidades.
    - Si es **Unidad**: retorna los datos del display padre de donde proviene.
    - Si no tiene relación: retorna `{ has_fractionation: false }`.
- `POST /api/v1/products/{product_id}/fractionation/link`
  - Body: `{ child_product_id: UUID, factor_conversion: int }`
  - Enlaza el display con una unidad ya existente en catálogo.
- `POST /api/v1/products/{product_id}/fractionation/quick-create-child`
  - Body: `{ codigo_barra: str, nombre: str, precio_venta: float, factor_conversion: int }`
  - Crea el producto hijo automáticamente:
    - Copia `categoria_id`, `supplier_id`, `iva_tasa` del display padre.
    - Asigna SKU derivado (ej. `SKU-PADRE-U`).
    - Calcula `costo_promedio` y `ultimo_costo` como `costo_display / factor_conversion`.
    - Asigna `precio_venta` especificado (con validación de precio minorista PYG).
    - Registra el vínculo en `product_fractionations`.
- `POST /api/v1/products/{product_id}/fractionation/execute-stock`
  - Body: `{ cantidad_displays: int, motivo: Optional[str] }`
  - Ejecuta la transacción atómica de desarme de bultos descrita en la Sección 3.
- `DELETE /api/v1/products/{product_id}/fractionation`
  - Desvincula la relación de fraccionamiento (sin alterar stocks históricos).

---

## 5. Experiencia de Usuario en Frontend (Producto 360)

En [Product360Modal.tsx](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ui-web/src/pages/products/Product360Modal.tsx), se transforma la pestaña `"codigos"` en **"Códigos & Presentaciones"**:

### Vista 1: Sección Códigos de Barra Secundarios (1:1 y Packs)
- Tabla con lista de códigos registrados (Código, Etiqueta descriptiva, Tipo: "Alternativo 1:1" o "Pack xN", Fecha).
- Botón **"+ Agregar Código Secundario"**:
  - Modal para ingresar Código de barras (con lector o teclado).
  - Selector rápido: `[Código Alternativo 1:1]` (ej. Brasil/Argentina) o `[Pack / Bulto]` (ingresar unidades).
  - Etiqueta opcional (ej: "EAN Brasil", "Six Pack").

### Vista 2: Sección Fraccionamiento de Display a Góndola
- **Si el producto actual es un Display con fraccionamiento configurado:**
  - Banner informativo: *"Este producto se fracciona en: [Nombre de Unidad] (1 Display = {factor} Unidades)"*.
  - Indicadores en vivo:
    - Stock actual en Displays cerrados: **`X cajas`**.
    - Stock actual en Unidades sueltas en góndola: **`Y unidades`**.
  - Botón de Acción Principal: **`⚡ Fraccionar Displays a Góndola`**.
    - Abre modal modal interactivo:
      - Input de Cajas a Abrir.
      - Cálculo en tiempo real: *"Se descontarán X displays y se sumarán Z unidades al stock de góndola"*.
      - Botón de confirmación con feedback visual y refresco inmediato de stocks en el modal 360 y en la grilla del catálogo.
- **Si el producto no tiene fraccionamiento configurado:**
  - Tarjeta de habilitación: *"¿Este producto se vende por unidad suelta?"*
  - Dos botones:
    - **"Vincular a Unidad Existente"**: Selector con autocompletado de productos del catálogo.
    - **"Crear Unidad Fraccionada"**: Modal ágil para dar de alta la golosina suelta con su código de barras, nombre sugerido y precio de venta unitario.
- **Si el producto actual es una Unidad fraccionada:**
  - Badge distintivo: *"Unidad proveniente de: [Nombre Display]"*.
  - Botón para abrir directamente el Display padre en Producto 360.

---

## 6. Escaneo y Resolución en POS y Verificador de Precios

La función canónica de resolución de códigos de barra (`get_product_by_barcode` en [api/src/products/service.py](file:///Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/api/src/products/service.py)):
1. **Prioridad 1:** Código de barras principal en `products.codigo_barra`.
2. **Prioridad 2:** Código en `product_pack_barcodes`:
   - Si `unidades_por_paquete == 1`: Retorna el producto directamente (comportamiento sinónimo 1:1).
   - Si `unidades_por_paquete > 1`: Retorna el producto junto con los metadatos de pack para que el POS multiplique cantidad/precio de bulto.
3. **Escaneo de Display vs Unidad:**
   - Si se escanea el código del Display: cobra el display a su precio correspondiente.
   - Si se escanea el código del bombón/unidad: cobra la golosina individual a su precio minorista.

---

## 7. Plan de Verificación y Criterios de Éxito

1. **Pruebas de Códigos Alternativos 1:1:**
   - Registrar un código de barras de Brasil para un producto que ya tiene código principal de Paraguay.
   - Escanear el código alternativo: debe resolver el producto inmediatamente al precio unitario correcto sin duplicados.
2. **Pruebas de Fraccionamiento:**
   - Vincular un Display de 24 unidades con una golosina unitaria.
   - Desarmar 2 displays:
     - Stock Display: baja exactamente 2.
     - Stock Unidad: sube exactamente 48.
     - Kardex: movimientos `fraccionamiento_salida` y `fraccionamiento_entrada` generados correctamente.
3. **Pruebas de Concurrencia e Integridad:**
   - Intento de fraccionar más displays de los existentes: debe arrojar error 400 controlado ("Stock insuficiente de displays para fraccionar").
   - Intentar asignar un código de barras ya ocupado por otro producto: error 409 controlado con mensaje claro.
