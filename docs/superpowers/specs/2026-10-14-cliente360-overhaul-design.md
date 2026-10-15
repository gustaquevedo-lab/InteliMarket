# Especificación de Diseño: Overhaul Integral de Cliente 360 & Hub de Comunicación Inteligente

**Fecha:** 2026-10-14  
**Rama:** `vertical/supermercado`  
**Vertical:** Extra Supermercado (Retail & Frontera)  
**Zona Horaria:** `America/Asuncion` (UTC-4)  
**Estado:** Aprobado para Planificación  

---

## 1. Resumen Ejecutivo y Objetivos

El módulo de **Cliente 360** es el centro neurálgico de retención y fidelización de Extra Supermercado. Actualmente, la búsqueda y filtrado se encuentran restringidos a bloques limitados en frontend, la asignación de ofertas individuales carece de flexibilidad para seleccionar cualquier producto del catálogo general y el Hub de mensajería carece de personalizaciones de precios y visualización interactiva.

Este diseño define la reestructuración completa en 3 ejes:
1. **Búsqueda Universal & Filtros Multidimensionales:** Indexación server-side sobre los más de 10.000 clientes (sin límites artificiales), búsqueda por trigramas (`pg_trgm`) en PostgreSQL, soporte de fallback en caché y segmentación por riesgo de fuga, país/idioma, ExtraClub, arquetipos y ofertas activas.
2. **Constructor Híbrido de Ofertas 1-a-1 & Blindaje Anti-Costo:** Selección flexible de productos (Top frecuentes de su canasta real vs buscador del catálogo general), cálculo de costo base, piso mínimo inviolable (+5% de margen de seguridad), edición de precios con `<CurrencyInput />` (regla canónica #10) y cálculo de ahorro para el cliente en Gs. y %.
3. **Hub de Comunicación IntelliZapp & Simulador de WhatsApp:** Inyección automática de tokens de precio regular vs precio especial, conmutador bilingüe automático (Español 🇵🇾 y Portugués 🇧🇷), plantillas de alto impacto y simulador en vivo tipo smartphone con formato enriquecido.

---

## 2. Arquitectura de Datos y Búsqueda Universal

### 2.1. Endpoints y Consultas Server-Side
Para soportar el filtrado integral sobre la base completa de clientes sin truncamiento:
* **Filtros en Base de Datos:**
  * `search`: Búsqueda de texto normalizada sobre `razon_social`, `ruc`, `ci`, `telefono` y `extra_club_numero`.
  * `country`: Filtro bimonetario/idioma (`brasil`: prefijo `+55` o `idioma = 'pt'`; `paraguay`: resto).
  * `churn_risk`: Filtro por días de inactividad (`>30` o `>45` días sin compra).
  * `extra_club`: Clientes registrados en el programa de lealtad (`extra_club_numero IS NOT NULL`).
  * `has_active_offers`: Clientes con ofertas vigentes en `marketing_customer_offers` (`usado = false AND valido_hasta >= NOW()`).
  * `archetype`: Filtrado por arquetipo conductual.
* **Respuesta con Metadata Completa:**
  ```json
  {
    "total_matching": 1240,
    "total_base": 10495,
    "limit": 50,
    "offset": 0,
    "data": [...]
  }
  ```
* **Rendimiento e Índices:**
  * Uso de índices trigram en PostgreSQL (`gin (razon_social gin_trgm_ops)`) y B-Tree en `ruc`, `ci`, `telefono` y `extra_club_numero` para asegurar respuestas `< 20ms`.
* **Mecanismo de Fallback:**
  * Si la red experimenta micro-cortes, el frontend mantiene un buffer en memoria para permitir filtrado local instantáneo sin bloquear la interfaz.

---

## 3. Constructor de Ofertas 1-a-1 "Te Extrañamos"

### 3.1. Selección Híbrida de Productos
El modal de creación de oferta implementa dos modalidades de selección:
1. **Modo A: Canasta Habitual (1-Clic):**
   * Grilla interactiva con los productos que el cliente compra con mayor recurrencia (`frequent_basket`).
   * Despliega veces comprado, volumen histórico y último precio pagado.
   * Al seleccionar, pre-calcula un 15% OFF de cortesía validando el piso de costo.
2. **Modo B: Catálogo General con Autocompletado:**
   * Buscador integrado (`api.products.list`) para seleccionar cualquier artículo de góndola, carnicería, panadería o bebidas.

### 3.2. Blindaje Financiero Anti-Costo y Regla Canónica de Moneda
* **Datos Analíticos en Pantalla:**
  * **Precio Regular de Góndola:** Gs. formateado con `formatPYG()`.
  * **Costo Base de Compra:** Máximo entre `ultimo_costo` y `costo_promedio`.
  * **Piso de Seguridad Inviolable:** `Math.round(costo_base * 1.05)`.
* **Componente Canónico de Entrada:**
  * En cumplimiento estricto con la Regla #10 de la vertical de supermercado, se prohíbe `<input type="number">` y se utiliza exclusivamente `<CurrencyInput />` (`src/components/CurrencyInput.tsx`).
* **Bloqueo de Venta Bajo Costo:**
  * Si el operador tipea un valor inferior a `costo_base * 1.05`, el botón de guardado se bloquea y se muestra un banner de alerta con el monto mínimo permitido.
* **Cálculo de Ahorro para el Cliente:**
  * Monto de ahorro: `precio_regular - precio_oferta`.
  * Porcentaje de ahorro: `Math.round((ahorro / precio_regular) * 100)%`.
* **Vigencia en Caja:** Selector de 3, 7, 15 o 30 días.

---

## 4. Hub de Comunicación IntelliZapp & Simulador WhatsApp

### 4.1. Tokens y Formato Dinámico de Precios
El Hub parsea automáticamente los datos de la oferta activa o del cliente para generar mensajes personalizados:
* `{primer_nombre}`: Primer nombre del cliente.
* `{producto}`: Nombre del producto seleccionado.
* `{precio_regular}`: Formato Paraguay (`Gs. 45.000`).
* `{precio_especial}`: Formato Paraguay (`Gs. 34.000`).
* `{ahorro_monto}`: Formato Paraguay (`Gs. 11.000`).
* `{ahorro_pct}`: Porcentaje (`24% OFF`).
* `{valido_hasta}`: Fecha en hora paraguaya (`America/Asuncion`).
* `{puntos_club}`: Puntos ExtraClub acumulados.

### 4.2. Catálogo de Plantillas Bilingües (ES 🇵🇾 / PT 🇧🇷)
El Hub ofrece plantillas optimizadas para conversión en retail:
1. **Oferta 1-a-1 en Producto Preferido:**
   * *Español:* `¡Hola {primer_nombre}! 👋 En Extra Supermercado te preparamos un precio exclusivo en tu producto preferido *{producto}*: a solo *{precio_especial}* (Precio regular: ~{precio_regular}~. ¡Ahorrás {ahorro_monto}!). Solo tenés que dictar tu cédula en caja. Válido por {validez_dias} días.`
   * *Português:* `Olá {primer_nombre}! 👋 No Extra Supermercado preparamos um preço exclusivo no seu produto favorito *{producto}*: por apenas *{precio_especial}* (Preço normal: ~{precio_regular}~. Economia de {ahorro_monto}!). É só informar seu documento no caixa! Válido por {validez_dias} dias.`
2. **Reactivación "Te Extrañamos" (Abandono > 30 días):** Enfoque cálido para recuperar la visita.
3. **Alerta de Puntos ExtraClub:** Notificación de saldo y valor en vales de compra.
4. **Feria de Fin de Semana & Frescos:** Novedades de carnicería y frescos.
5. **Redacción Libre:** Con botones rápidos para insertar tokens con un solo clic.

### 4.3. Simulador Interactivo de WhatsApp en Pantalla
* Marco con aspecto de smartphone en la interfaz de usuario:
  * Cabecera estilo WhatsApp con avatar, nombre del cliente y estado *"en línea"*.
  * Burbuja verde de chat saliente con renderizado en tiempo real de tipografía, saltos de línea, negritas `*...*` y emojis.
  * Marca de tiempo local paraguaya (`America/Asuncion`) y doble check azul/gris.
  * Modificación bidireccional inmediata al tipear en el editor de texto.

### 4.4. Opciones de Envío
* **API IntelliZapp Directa:** Despacho automatizado mediante `api.whatsapp.sendTestMessage`.
* **WhatsApp Web / App (`wa.me`):** Redirección segura con el texto codificado en URI.
* **Copiar al Portapapeles:** Copia rápida con indicador visual.

---

## 5. Criterios de Aceptación y Validación

1. **Búsqueda & Filtros:**
   - La búsqueda debe filtrar sobre la base total de clientes de Extra Supermercado, mostrando el recuento real.
   - Los filtros de país (Brasil/Paraguay), ExtraClub, riesgo de fuga y ofertas activas deben funcionar de forma combinada.
2. **Ofertas 1-a-1:**
   - Permite seleccionar tanto de la canasta frecuente como del buscador general de productos.
   - El precio especial no puede ser inferior a `costo_base * 1.05`.
   - Se utiliza `<CurrencyInput />` con formato entero de Guaraníes (`Gs.`).
   - La oferta se guarda en base de datos y queda disponible para caja física.
3. **Hub de Comunicación:**
   - Al crear una oferta, el Hub se pre-carga con el precio regular y el precio especial en la plantilla.
   - El conmutador de idioma cambia los textos entre Español y Portugués de forma fluida.
   - El simulador de WhatsApp refleja exactamente el texto que se enviará.
4. **Respeto a Reglas del Repositorio:**
   - Cero modificaciones a archivos de POS (`ui-web/src/pages/pos/`) o Electron.
   - Fechas en `America/Asuncion`.

---

## 6. Siguientes Pasos
Una vez aprobado este documento de diseño, se invocará el skill `writing-plans` para desglosar la implementación paso a paso con pruebas y verificación.
