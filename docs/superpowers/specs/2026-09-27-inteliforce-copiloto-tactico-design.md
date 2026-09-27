# Especificación de Diseño: Inteliforce Overhaul "Copiloto Táctico B2B"

- **Fecha:** 2026-09-27
- **Estado:** Aprobado / Listo para Plan de Implementación
- **Autor:** Equipo de Arquitectura de Intelimarket / Inteliforce
- **Público Objetivo:** Vendedores de Calle y Supervisores Comerciales de Casa Gonzalito
- **Stack Técnico:** React Native (Expo SDK 57), Expo Router, TypeScript, Zustand, TanStack Query, Expo SQLite, Expo Haptics, FastAPI, PostgreSQL (asyncpg/SQLAlchemy).

---

## 1. Visión y Objetivos

Convertir a **Inteliforce** en una herramienta comercial móvil de vanguardia mundial ("Copiloto Táctico B2B"), superando las aplicaciones tradicionales de toma de pedidos y ruteo pasivo.

### Objetivos Clave:
1. **Excelencia Visual y Ergonómica (UI/UX Pro Max):**
   - Implementar un diseño táctico con fondo Azul Medianoche de Intelimarket (`#0F172A`) en Modo Oscuro y blanco nítido (`#FFFFFF`) con acentos de alta legibilidad en Modo Claro.
   - Touch targets ergonómicos de 48dp y componentes *overflow-proof*.
2. **Flujo de Asistencia como Candado Comercial (Gatekeeper):**
   - Nada de la jornada comercial (visitas, pedidos, cobros) puede ejecutarse sin haber marcado entrada oficial del día.
3. **Hoja de Ruta y Mapa Consolidado:**
   - Visualización dual de ruta: Lista secuencial optimizada y Mapa satelital interactivo con pines numerados y cálculo de distancia en tiempo real.
4. **Ficha 360 y Copiloto Comercial Marco IA:**
   - Análisis predictivo de recompra, alertas de días sin compra, semáforo de cheques/crédito y botón de 1-click para *"Cargar Pedido Sugerido por Marco"*.
5. **Catálogo B2B de Alta Velocidad y Stepper Háptico:**
   - Búsqueda debounced, carrusel de categorías/marcas, stock en vivo, stepper con vibración háptica y validación instantánea contra el crédito disponible.
6. **Dashboard de Pacing y Estimador de Comisiones:**
   - Gráficos de avance mensual, runrate diario requerido y cálculo proyectado de comisiones en Guaraníes (`formatGS`).

---

## 2. Arquitectura de Interfaces y Pantallas

### 2.1. Navegación Principal (`inteliforce/app/(vendedor)/_layout.tsx`)
El orden de pestañas se establece con jerarquía estricta:
1. **Asistencia (`asistencia.tsx`):** Estado de jornada, reloj en vivo, marcación GPS/selfie, resumen de jornada y panel de equipo para supervisores.
2. **Mi Ruta (`index.tsx`):** Selector [Lista / Mapa], tarjetas de visita con GPS y KPIs rápidos, modal de inspección y actualización de coordenadas.
3. **Clientes (`clientes/index.tsx`):** Directorio unificado de clientes con búsqueda multicampo y acceso a la Ficha 360.
4. **Metas (`metas.tsx`):** Gráfico de pacing, desglose por línea de productos y estimador de comisiones ganadas.

---

## 3. Especificaciones Funcionales por Módulo

### 3.1. Flujo de Asistencia y Candado de Jornada (`asistencia.tsx` e `index.tsx`)
- **Estados de Jornada:** `sin_marcar`, `en_jornada`, `en_pausa`, `jornada_cerrada`.
- **Lógica de Bloqueo en Campo:**
  - Si el vendedor no tiene `estado_jornada === 'en_jornada'`, tanto la pantalla de *Mi Ruta* como la de *Clientes* muestran un banner táctico fijado en la parte superior:
    > ⚠️ **Jornada no iniciada:** Debes registrar tu entrada en Asistencia para habilitar el ruteo, check-in GPS y la toma de pedidos.
  - Los botones de *"Iniciar Visita en Local"* y *"Nuevo Pedido"* se deshabilitan visualmente (`opacity: 0.5`) y al tocarlos disparan un toast o alerta: *"Debes marcar entrada primero"*, con opción de navegar directo a Asistencia.
- **Acciones en Asistencia:**
  - Registro de Entrada / Salida con captura obligatoria de coordenadas GPS (`expo-location`).
  - Sincronización transparente con el módulo de SueldOK en backend (`/attendance/punch`).
  - Feedback háptico de éxito `haptic.success()` al registrar marcación.

### 3.2. Mi Ruta con Vista Dual [Lista / Mapa] (`index.tsx`)
- **Cabecera Táctica:**
  - Selector segmentado animado: **[ Lista ]** / **[ Mapa ]**.
  - Pacing mini-card con progreso porcentual y ritmo diario.
  - Buscador universal (Razón Social, Nombre Fantasía, RUC, CI, Código Interno).
- **Modo Lista (Tarjetas de Visita):**
  - Número de orden secuencial sin `#0` (`#1, #2, #3...`).
  - Insignia de GPS:
    - **GPS Activo (Verde):** Coordenadas válidas + cálculo de distancia geodésica al usuario (ej. `• A 420 m`).
    - **Sin Coordenadas (Ámbar):** Botón directo para capturar ubicación en el local.
  - Insignias de alerta: Moroso (con número de facturas vencidas), Cheques pendientes.
  - Resumen financiero en Guaraníes: `formatGS(saldo_disponible)`.
- **Modo Mapa Consolidado:**
  - Componente de mapa (`react-native-maps`) centrado en la posición actual del vendedor.
  - Marcadores personalizados circulares numerados según el orden de visita.
  - Colores de pines:
    - Azul/Cyan: Pendientes.
    - Verde: Completados.
    - Naranja/Rojo: Clientes con mora o alertas financieras.
  - Al tocar un pin: tarjeta flotante inferior con datos clave del cliente y botón *"Iniciar Visita"*.
- **Modal de Actualización GPS con Auditoría:**
  - Modal con selector de motivo: `precision_gps`, `mudanza_local`, `error_inicial`.
  - Captura de precisión en metros (`accuracy`) y envío a `POST /customers/{id}/location`.

### 3.3. Ficha 360 del Cliente y Copiloto Marco IA (`clientes/[id].tsx`)
- **Panel Copiloto Marco IA:**
  - Bloque hero destacado con degradado sutil Azul Medianoche / Esmeralda.
  - Resumen analítico: días transcurridos desde la última compra, nivel de riesgo y recomendación personalizada de reposición.
  - **Botón de Acción Rápida: "Cargar Pedido Sugerido por Marco"**:
    - Al presionar, inicializa el carrito en `useVisit` con los productos y cantidades sugeridas.
    - Redirige directamente al carrito/confirmación de pedido.
- **Salud Crediticia y Cartera:**
  - Barra de crédito interactiva: Límite, Saldo Utilizado y Disponible en Gs.
  - Tarjetas de documentos: Facturas pendientes (con badge de días de vencimiento), cheques en cartera y cheques rebotados.
- **Historial de Ventas y Top Productos:**
  - Tabla de últimas facturas con estado y total.
  - Lista de productos más comprados con frecuencia de compra y precio habitual.

### 3.4. Catálogo y Toma de Pedidos B2B (`pedido/index.tsx` y `pedido/confirmar.tsx`)
- **Refactorización de Tema:**
  - Eliminación de colores estáticos hardcodeados en favor de `useTheme()`.
- **Filtros por Categoría y Marca:**
  - Carrusel horizontal de chips scrolleables: `Todos`, `Lácteos`, `Embutidos`, `Bebidas`, `Secos`, `Limpieza`, etc.
  - Filtrado instantáneo local sobre la lista en memoria.
- **Tarjeta de Producto Táctica (`ProductCard.tsx`):**
  - Imagen/Icono representativo de línea.
  - Nombre con 2 líneas legibles, SKU y precio en Gs. con `formatGS`.
  - Indicador de stock en tiempo real:
    - Stock > 10: badge verde `En Stock`.
    - 1 a 10: badge ámbar `Últimas {stock} un.`.
    - 0: badge gris `Agotado` (deshabilita botón de adición).
  - Stepper táctil con feedback háptico `haptic.light()` y `haptic.medium()`.
- **Barra de Pedido Flotante (`CartSummary.tsx`):**
  - Barra inferior con badge de cantidad de ítems, subtotal acumulado y botón *"Ver Pedido"*.
  - Alerta en vivo si el subtotal supera el crédito disponible del cliente.
- **Pantalla de Confirmación (`pedido/confirmar.tsx`):**
  - Desglose de ítems con opción de modificar cantidades o eliminar.
  - Selector de condición de pago: Contado o Crédito (con visualización de días de plazo autorizados).
  - Campo de notas de entrega o despacho.
  - Botón de envío con `haptic.success()` y sincronización offline en SQLite si no hay conexión.

### 3.5. Metas y Estimador de Comisiones (`metas.tsx`)
- **Visualización Gráfica:**
  - Anillo de avance porcentual de venta vs meta.
  - Barra comparativa de pacing: esperado según día del mes vs real alcanzado.
- **Estimador de Comisiones:**
  - Tarjeta con cálculo estimado de comisiones acumuladas del mes en Guaraníes:
    $$\text{Comisión Estimada} = \text{Venta Acumulada} \times \text{Tasa Base (\%)} \times \text{Factor de Cumplimiento}$$
  - Escala de incentivos y premios por sobrecumplimiento (>100%).
- **Desglose por Línea:**
  - Avance de venta clasificado por categoría/marca asignada al vendedor.

---

## 4. Diseño del Sistema de Tokens UI/UX Pro Max

### Paleta Oficial Unificada

| Token Semántico | Modo Claro (High-Utility) | Modo Oscuro (Intelimarket Midnight) |
|---|---|---|
| **Fondo Principal** | `#F8FAFC` (Slate 50) | `#0F172A` (Midnight Slate 900) |
| **Tarjeta Base** | `#FFFFFF` | `#1E293B` (Slate 800) |
| **Tarjeta Elevada** | `#F1F5F9` | `#232E42` (Elevated Navy) |
| **Borde / Separador** | `#E2E8F0` | `#334155` (Slate 700) |
| **Texto Principal** | `#0F172A` (Contraste 16:1) | `#F8FAFC` (Contraste 15:1) |
| **Texto Secundario** | `#475569` | `#94A3B8` |
| **Texto Muted** | `#64748B` | `#64748B` |
| **Primario / Acción** | `#006B2C` (Esmeralda Táctico) | `#01A751` (Verde Inteliforce) |
| **Secundario / Info** | `#1D4ED8` (Azul Real) | `#38BDF8` (Cyan Satelital) |
| **Alerta / Pacing** | `#D97706` (Ámbar) | `#F59E0B` (Ámbar Brillante) |
| **Peligro / Deuda** | `#DC2626` (Rojo) | `#EF4444` (Carmesí Vivo) |

---

## 5. Criterios de Aceptación y Pruebas

1. **Jornada de Trabajo:**
   - La app bloquea la ejecución de visitas y pedidos si no se ha marcado entrada.
   - Al marcar entrada, se habilitan inmediatamente todas las funciones de campo.
2. **Ruta y Mapa:**
   - No existe ningún cliente con `#0` en la lista.
   - El selector [Lista / Mapa] conmuta sin recargas pesadas ni parpadeos.
   - El modal de actualización GPS registra el motivo y actualiza las coordenadas en backend y en la base SQLite local.
3. **Ficha 360 y Marco IA:**
   - El botón *"Cargar Pedido Sugerido por Marco"* llena el carrito en un solo toque y abre la pantalla de confirmación.
   - Los cheques y deudas se exponen en Guaraníes con puntos de miles y sin decimales.
4. **Catálogo:**
   - Toda la interfaz responde al tema activo sin textos ilegibles o fondos negros planos.
   - Los filtros de categorías filtran la FlashList de forma instantánea (<16ms).
5. **Calidad de Código y Tipado:**
   - `npx tsc --noEmit` en `inteliforce/` debe compilar con **0 errores**.
   - Respeto total de las reglas de `GEMINI.md`: prohibido tocar `Dashboard.tsx` o `Layout.tsx` de `ui-web`.
