---
name: ui-ux
description: Guía integral de diseño UI/UX, sistemas de diseño, estética visual premium y micro-interacciones para interfaces web y móviles (Intelimarket y Inteliforce).
---

# Skill de Diseño UI/UX y Sistemas de Interfaz

Esta skill establece los principios, estándares de calidad visual, reglas ergonómicas y patrones de interacción para el desarrollo de interfaces en **Intelimarket** (web) y **Inteliforce** (móvil).

---

## 1. Filosofía de Diseño: "Vanguardia y Utilidad Táctica"

Las aplicaciones de Intelimarket e Inteliforce no deben lucir como herramientas corporativas genéricas o MVPs básicos. Deben transmitir **calidad premium, solidez y velocidad inmediata**, adaptadas a las realidades de uso:
- **Inteliforce (Móvil):** Operación en campo, a plena luz del día o de noche, uso a una mano por vendedores y repositores, tiempos de atención reducidos frente al cliente.
- **Intelimarket (Web):** Gestión densa de datos, control analítico, reportes financieros y dashboards ejecutivos de alto impacto.

---

## 2. Paleta de Colores y Consistencia de Modo Claro / Oscuro

### Regla Fundamental de Fondos y Contraste
1. **Prohibido el negro puro plano (`#000000`) para fondos generales:**
   - En Modo Oscuro, utilizar fondos enriquecidos en escala pizarra / medianoche:
     - Fondo principal: `#0B132B` o `#0F172A` (Azul medianoche profundo de Intelimarket).
     - Tarjetas y contenedores elevados: `#1E293B` o `#1E2235`.
     - Bordes y divisores: `#334155` con opacidad sutil (`rgba(255, 255, 255, 0.08)`).
2. **Modo Claro nítido y limpio:**
   - Fondo principal: `#F8FAFC` o `#F1F5F9`.
   - Tarjetas y superficies: `#FFFFFF` con sombras suaves y difusas (`shadow-sm` / `elevation: 2`).
3. **Consistencia Cromática de Marca:**
   - **Primario / Acción:** Azul Real Intelimarket (`#2563EB` o `#1D4ED8`) con acentos vibrantes (`#38BDF8`).
   - **Éxito / GPS Activo / Avance:** Esmeralda nítido (`#10B981` / fondo claro `#DCFCE7`, oscuro `#064E3B`).
   - **Alerta / Pacing / Pendientes:** Ámbar cálido (`#F59E0B` / fondo claro `#FEF3C7`, oscuro `#78350F`).
   - **Peligro / Deuda / Moroso:** Carmesí vivo (`#EF4444` / fondo claro `#FEE2E2`, oscuro `#450A0A`).
   - **Textos:**
     - En Modo Claro: Principal `#0F172A`, Secundario `#475569`, Muted `#94A3B8`.
     - En Modo Oscuro: Principal `#F8FAFC`, Secundario `#CBD5E1`, Muted `#64748B`.

---

## 3. Jerarquía Visual y Tipografía

1. **Escaneo Rápido (Scannability):**
   - El ojo del usuario debe identificar en menos de 1 segundo: **¿Quién es el cliente?**, **¿Cuál es el estado?**, **¿Hay alertas financieras (moroso/saldo)?** y **¿Dónde está el botón de acción principal?**.
2. **Formato Numérico y Monetario Obligatorio:**
   - Todo monto en Guaraníes debe formatearse mediante `formatGS(monto)`:
     - Separador de miles con punto (`.`): `Gs. 1.500.000`.
     - **Nunca** mostrar decimales para Guaraníes.
     - **Nunca** mostrar identificadores UUID crudos a los usuarios finales; usar códigos internos, RUC o Cédula.
3. **Tipografía:**
   - Encabezados claros, concisos y con peso `bold` o `black` (`fontWeight: '700'` o `'800'`).
   - Píldoras e insignias legibles: fuente condensada con `fontWeight: '600'`, espaciado de tracking uniforme y mayúsculas/minúsculas naturales (*"GPS Activo"*, no *"GPSACTIVO"*).

---

## 4. Ergonomía Móvil (Inteliforce / React Native)

1. **Touch Targets Generosos:**
   - Todo elemento interactivo (botones, inputs, toggles, chips) debe tener un área táctil mínima de **44 x 44 dp**.
2. **Prevención de Desbordamientos (Overflow-Proof):**
   - Nunca fijar anchos rígidos en contenedores de texto variable.
   - En listas de etiquetas o insignias (RUC, Código, GPS, Moroso), utilizar siempre `flexDirection: 'row'`, `flexWrap: 'wrap'` y `gap: 6` para que los chips se adapten a cualquier tamaño de pantalla sin salirse del card.
3. **Respeto a Áreas Seguras (Safe Areas):**
   - Contemplar siempre el notch superior y la barra de navegación gestual inferior de Android / iOS (`useSafeAreaInsets` o `SafeAreaView`).
   - El contenido scrollable debe tener `contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}` para que los botones flotantes o pestañas nunca tapen el último elemento.
4. **Respuesta Háptica Táctil (`expo-haptics`):**
   - `haptic.light()` al pulsar chips de filtro o incrementar cantidades.
   - `haptic.medium()` al agregar productos al pedido o abrir acciones.
   - `haptic.success()` al registrar un check-in GPS o confirmar un pedido exitoso.
   - `haptic.warning()` ante advertencias geográficas o crédito límite excedido.

---

## 5. Micro-interacciones y Estados de Carga

1. **Feedback Inmediato (Cero Lag Percibido):**
   - Las operaciones de guardado local (SQLite offline) deben ejecutarse en segundo plano sin congelar la pantalla.
   - Las consultas deben contar con `staleTime` razonable (mínimo 60s) para que la navegación entre pestañas sea instantánea sin mostrar spinners repetitivos.
2. **Estados Vacíos con Propósito:**
   - Si no hay resultados de búsqueda o clientes pendientes, nunca mostrar un espacio en blanco.
   - Incluir un ícono representativo, un título explicativo y una acción clara (ej. *"Limpiar búsqueda"* o *"Cambiar filtro"*).

---

## 6. Reglas de Protección y Blindaje de Código

1. **Dashboard y Sidebar Intocables:**
   - La estructura, KPIs de Pacing y navegación del **Dashboard Web** (`ui-web/src/pages/Dashboard.tsx`) y del **Sidebar** (`ui-web/src/components/Layout.tsx`) son estructuras graníticas permanentes. No alterar sin autorización expresa previa del usuario.
2. **Modularidad y Tokens Centralizados:**
   - Todo componente debe alimentarse de tokens de tema (`useTheme`), evitando colores hardcodeados como `#FFF` o `#000` directamente en los estilos locales.
