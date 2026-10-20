# Especificación de Arquitectura: Bloque Operaciones de Salón (Extra Supermercado)

**Fecha:** 20 de Octubre de 2026  
**Rama:** `vertical/supermercado`  
**Tenant:** Extra Supermercado (Grupo Santa Teresa E.A.S. — RUC 80150377-9)  
**Estado:** Propuesta de Diseño Aprobada por el Usuario  

---

## 1. Diagnóstico y Realidad Operativa

### 1.1 El Problema Fundamental
Los 8 módulos del bloque **Operaciones de Salón** (`Hub Operaciones`, `Verificador de Precios`, `TV Digital Carnicería`, `Carnicería y Desposte`, `Verdulería y Frescos`, `Panadería y Rotisería`, `Inocuidad y HACCP`, `Mantenimiento de Equipos`) fueron concebidos con sobreingeniería de oficina y formularios académicos de múltiples pasos, desconectados de la dinámica de piso en un supermercado con guantes, balanzas y tablets.

### 1.2 Evidencia Crítica en Base de Datos de Producción
Al inspeccionar la base de datos PostgreSQL en `100.83.91.76`:
1. **Hardware Activo**:
   - `cc92e847-9258-4348-be10-e89bc16841b6`: **Balmak Edge · Carnicería** (`192.168.0.72:4011`).
   - `1e38e497-3128-406c-b4c9-714462da7acd`: **Balmak Edge · Carnicería (Cabezal 2)** (`192.168.0.74:4010`).
   - `23a75527-851a-403d-bd4e-6d674a5f9841`: **Balmak Edge · Panadería & Rotisería** (`192.168.0.73:4001`).
   - Catálogo vivo: **540 productos con `plu_balanza`** transmitidos y sincronizados por el vigilante de precios.
2. **Causa Raíz de Saldos Negativos**:
   - `api/src/supermer/service.py::execute_desposte` guardaba registros en `ProductionBatch`, pero **nunca generaba movimientos de inventario (`InventoryMovement`) ni actualizaba la tabla `stock`** para los cortes resultantes.
   - **Consecuencia directa**: En las cajas POS se venden cortes pesados en las Balmak Edge, pero al no tener entrada de desposte, productos nobles como `ML LOMITO/FILE MIGNON KG` (PLU 2) exhiben **-22 kg** en stock, y `PAN FRANCES KG` (PLU 98) exhibe **-107 kg**, mientras que la materia prima (`RES ENTERA BOVINA`, SKU `120206`) permanece estancada.

---

## 2. Arquitectura de los 8 Módulos de Salón

```
                         [ INGRESO DE MERCADERÍA ]
                                     │
           ┌─────────────────────────┴────────────────────────┐
           ▼                                                  ▼
   [ CARNICERÍA ]                                     [ PANADERÍA ]
  Res Entera / Planchas                            Harina, Grasa, Levadura
           │                                                  │
           ▼                                                  ▼
  Fórmulas Técnicas Desposte                         Horneada Rápida (1 Tap)
 (Vaca 6 cortes, Costilla, Cerdo)                   (Francés, Felipe, Chipa)
           │                                                  │
           ▼                                                  ▼
 [ ALIMENTACIÓN REAL DE STOCK ]                     [ ALIMENTACIÓN REAL DE STOCK ]
  - Descuenta Insumo (Res)                           - Descuenta Insumo (Harina)
  + Suma Cortes Vendibles                            + Suma Kilos Pan Elaborado
  + Asienta Merma/Grasa/Hueso                        + Regulariza Saldo Negativo
           │                                                  │
           └─────────────────────────┬────────────────────────┘
                                     │
                                     ▼
                      [ BALANZAS BALMAK EDGE ]
                (2 en Carnicería / 1 en Panadería)
                                     │
           ┌─────────────────────────┼────────────────────────┐
           ▼                         ▼                        ▼
 [ TV DIGITAL CARNICERÍA ]  [ VERIFICADOR PRECIOS ]    [ HUB TABLET PWA ]
 Pantalla mostrador HDMI     Kiosco pasillo cliente     Reposición, Quiebres
 Precios en vivo y ofertas   EAN-13 + Código Balanza    Mermas y Flejes Express
```

---

## 3. Especificación Detallada por Módulo

### 3.1 Carnicería & Desposte: Motor de Rendimiento Real y Stock
- **Fórmulas Maestras Activas en BD (`supermer_butchery_templates`)**:
  - `Vaca 6 Cortes c/ Cupim (200-249kg)`: Despiece en 26 cortes y subproductos (Costilla 12.06%, Bisteca 10.91%, Molida 8.64%, Carnaza Negra 5.84%, Carnaza Blanca 5.75%, Cara de Paleta 5.71%, Puchero 2da 7.28%, Vacio 2.75%, Picanha 1.29%, Lomito 1.08%, Gordura 8.47%, Hueso 4.20%, Merma 3.55%, etc.).
  - `Costilla con Vacío`: Costilla/Matambre 73.98%, Vacío 16.20%, Gordura 7.82%, Merma 1.99%.
  - `Cerdo Entero s/ Cabeza (BR)`: Pernil 27.15%, Paleta 25.82%, Costilla 20.59%, Bisteca 14.14%, Lomito 1.54%, Puchero 6.56%, Merma 4.20%.
- **Flujo de Ejecución en Tablet**:
  1. El carnicero selecciona la plantilla con 1 toque.
  2. Ingresa los Kilos de Entrada de la res (ej. `250 kg`) y el Costo Total (o autocompleta con el último costo registrado de `RES ENTERA BOVINA`).
  3. La interfaz calcula instantáneamente los kilos y costo unitario por corte según la fórmula.
  4. Botón principal: **"Confirmar Desposte y Alimentar Stock"**.
- **Impacto Backend Transaccional (`api/src/supermer/service.py`)**:
  - `InventoryMovement(tipo="salida_produccion", product_id=res_id, cantidad=-kilos_entrada)`.
  - Bucle por corte: `Stock(product_id=corte.product_id, cantidad += kilos_corte)` + `InventoryMovement(tipo="entrada_produccion", cantidad=+kilos_corte, costo_unitario=costo_ponderado)`.
  - Inserción de `WasteLog` con la merma técnica resultante (`cantidad = kilos_merma, tipo_merma="merma_natural"`).

### 3.2 Panadería & Rotisería: Horneadas Batch y Saldo Positivo
- **Flujo de Panadería en Tablet**:
  - Panel táctil con tarjetas de horneada preconfiguradas:
    * `Horneada Pan Francés (Bolsa 50kg Harina)` -> Genera 68 kg `PAN FRANCES KG` (PLU 98).
    * `Horneada Pan Felipe (Bolsa 50kg Harina)` -> Genera 65 kg `PAN FELIPE` (PLU 100).
    * `Tanda Pan de Ajo` -> Genera bandejas (PLU 716).
    * `Tanda Chipa Tradicional`.
  - Al pulsar "Confirmar Horneada":
    * Descuenta materia prima de almacén (`salida_produccion`: Harina 000, Grasa, Levadura, Sal).
    * Incrementa el stock vendible en salón (`entrada_produccion`) con su costo unitario calculado.
    * Erradica el saldo negativo histórico en el mostrador de panadería.
- **Rotisería**:
  - Producción rápida de tandas: `Pollo al Spiedo` (unidades), `Milanesas de Carne/Pollo` (kg), `Tartas y Empanadas`.

### 3.3 TV Digital Carnicería (`/kiosk/carniceria-tv`)
- **Diseño 1080p / Pizarra Digital en Tema Oscuro**:
  - Interfaz full-screen optimizada para 1920x1080 (Smart TV / TV Box HDMI en mostrador) en fondo negro profundo (`bg-slate-950` / `bg-black`) con tipografía de alto contraste legible a 8-10 metros.
  - **Formato Lista de Precios de Carnicería (Digital Price Board)**:
    * Presentación en columnas limpias y equilibradas (evita scroll vertical; todo visible de un solo vistazo).
    * Columnas: Nombre del Corte, Categoría, Precio por Kg (`₲ 34.777`).
  - **Destaque Automático de Promociones**:
    * Si el corte tiene una oferta activa (`precio_fijo_oferta`, porcentaje de descuento o promo de catálogo), el sistema le aplica automáticamente:
      - Badge brillante de oferta (`OFERTA`, `PROMO`).
      - Precio anterior tachado (ej: `~~39.777~~`).
      - Precio promocional en tipografía resaltada dorada / amarillo vibrante.
  - **Control Centralizado desde la Tablet (Hub Operaciones / Carnicería)**:
    * En la tablet, el encargado tiene un panel dedicado: *"Gestor de Pizarra TV"*.
    * Permite marcar con switches/checkboxes qué cortes están activos para mostrarse en la TV (ej. ocultar cortes sin stock o priorizar los 12 cortes clave del día).
    * La configuración de cortes visibles se almacena en PostgreSQL (`settings_company`, clave `tv_carniceria_config`).
    * Al modificar la selección en la tablet, la TV Digital detecta el cambio en su polling de 20-30 segundos y actualiza su lista de inmediato sin parpadeo ni intervención física en el televisor.
- **Sincronización en Vivo**:
  - Endpoint dedicado `GET /api/v1/supermer/butchery/tv-cuts` (público para display sin sesión).
  - Endpoint de gestión `PUT /api/v1/supermer/butchery/tv-cuts/visibility` (usado por la tablet con autenticación).

### 3.4 Verificador de Precios Kiosco (`/kiosk/verificador-precios`)
- **Diseño**: Pantalla táctil de pasillo para tótem con lector de código de barras.
- **Doble Lógica de Lectura**:
  1. **Código EAN-13 Comercial**: Búsqueda por SKU/código de barras. Muestra:
     - Nombre del producto y categoría.
     - **Precio Minorista** (1 unidad).
     - **Precio Mayorista** (a partir de 3 o 6 unidades) destacado en verde.
     - Indicador de ahorro si tiene oferta activa.
  2. **Código EAN-13 Balmak Edge (Prefijo `20`)**:
     - Parsea los primeros dígitos como `PLU` y los siguientes como `Peso` o `Importe`.
     - Identifica el producto cárnico o de panadería, muestra los kilos del paquete y el monto exacto a pagar en caja.
- **Resiliencia Operativa**:
  - Barra de progreso regresiva de 7 segundos que reinicia la vista automáticamente al estado de bienvenida.
  - Teclado numérico táctil en pantalla por si el cliente desea tipear el código a mano.

### 3.5 Hub Operaciones (PWA en Tablet)
- **Diseño Ergonómico**: Pensado para uso a dos manos en tablet de 10" a 12".
- **Módulos de 1 Toque**:
  1. **Reposición & Quiebres de Góndola**:
     - Escaneo de producto con cámara o lector bluetooth.
     - Muestra: Stock en Salón vs. Stock en Depósito Central.
     - Botón `[ Solicitar Reposición a Depósito ]`.
  2. **Merma Express**:
     - Escaneo de producto averiado o vencido.
     - 4 botones táctiles grandes: `[ Vencido ]`, `[ Golpeado / Roto ]`, `[ Pérdida de Vacío ]`, `[ Descarte ]`.
     - Asienta `WasteLog` y descuenta del stock en 2 segundos.
  3. **Auditoría de Flejes**:
     - Escaneo del fleje en góndola. Si el precio en góndola difiere del sistema, genera solicitud en la cola de impresión de flejes.
  4. **Lanzador Rápido**: Accesos directos a Desposte, Horneada, Temperaturas y Averías.

### 3.6 Verdulería y Frescos (FLV)
- **Operación**:
  - Registro de merma diaria de cajones: pesaje matutino o vespertino de frutas/verduras descartadas por merma natural.
  - Botón de **Markdown / Liquidación**: reduce el precio de venta un 30% o 50% para fruta madura (ej. tomate para salsa, bananas maduras) y empuja el precio a las balanzas antes del descarte total.

### 3.7 Inocuidad y HACCP (Seguridad Alimentaria)
- **Registro Rápido en Tablet**:
  - 3 lecturas diarias por turno:
    * Cámara Frigorífica Carnes (Rango seguro: -2°C a 2°C).
    * Cámara Frigorífica Lácteos / Fiambres (Rango seguro: 2°C a 6°C).
    * Vitrinas Exhibidoras de Salón (Rango seguro: 0°C a 4°C).
  - Semáforo visual: Verde (Normal), Amarillo (Advertencia), Rojo (Crítico con notificación sonora / badge para prevenir corte de cadena de frío).

### 3.8 Mantenimiento de Equipos
- **Equipos Monitoreados**:
  - Balanzas Balmak Edge (Carnicería 1, Carnicería 2, Panadería).
  - Sierra carnicera sin fin.
  - Picadora comercial.
  - Horno rotativo de panadería.
  - Cortadoras de fiambre.
- **Botón "Reportar Falla" de 2 Toques**:
  - Selección de máquina -> Clic en problema común (`"Cuchilla desafilada"`, `"No imprime ticket"`, `"Ruido de motor"`, `"Pérdida de gas/frío"`).
  - Dispara orden de trabajo para técnico de mantenimiento.

---

## 4. Estándar de Componentes y Reglas Canónicas (`GEMINI.md`)

1. **Arquitectura de Modales**:
   - Contenedor: `max-h-[90vh] flex flex-col rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800`.
   - Cabecera: `shrink-0 p-4 border-b flex justify-between items-center`.
   - Cuerpo central: `flex-1 overflow-y-auto p-4 space-y-4` (adaptable a cualquier resolución).
   - Pie de acciones: `shrink-0 p-4 border-t bg-slate-50 dark:bg-slate-900/80 flex justify-end gap-3 sticky bottom-0`.
2. **Formato Monetario**:
   - Uso obligatorio de `<CurrencyInput />` en inputs de costos y precios.
   - Formato PYG sin decimales ni sufijos `Gs.` en reportes internos (`formatPYG()`).
3. **Zona Horaria Inmutable**:
   - Todo timestamp de desposte, lote o merma se registra y formatea bajo `America/Asuncion`.

---

## 5. Plan de Fases de Implementación

1. **Fase 1 (Backend Core & Stock Feed)**:
   - Modificar `execute_desposte` en `api/src/supermer/service.py` para vincular formalmente la salida de materia prima (`RES ENTERA BOVINA`) y la entrada de los 26 cortes a `Stock` y `InventoryMovement` con costos ponderados.
   - Implementar endpoint rápido de ejecución de horneada de panadería (`execute_bread_batch`).
2. **Fase 2 (UI Carnicería & Desposte + Panadería en Tablet)**:
   - Rediseñar `CarniceriaDespostePage.tsx` con modo pesaje táctil directo basado en las fórmulas existentes.
   - Rediseñar `PanaderiaRotiseriaPage.tsx` con tandas de 1 tap.
3. **Fase 3 (Kioscos y Displays Autónomos)**:
   - Refactorizar `PriceCheckerKioskPage.tsx` (soporte dual de códigos y precios mayoristas).
   - Refactorizar `CarniceriaTvDigitalPage.tsx` (diseño pizarra digital oscura 1080p con actualización en vivo).
4. **Fase 4 (Hub Tablet PWA, Frescos, HACCP y Equipos)**:
   - Refactorizar `SalonOperacionesPwaPage.tsx` dividiendo el monolito en subcomponentes modulares de reposición, mermas y auditoría.
   - Simplificar `HaccpPage.tsx` y `EquipmentPage.tsx` a control de temperaturas y reporte rápido de averías.
5. **Fase 5 (Validación, Build y Despliegue Zero-Downtime)**:
   - Ejecutar pruebas automatizadas.
   - Compilar frontend con `npm run build`.
   - Desplegar con `bash deploy-api.sh` y `bash deploy-ui.sh`.
