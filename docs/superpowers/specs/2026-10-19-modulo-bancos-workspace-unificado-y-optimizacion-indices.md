# Especificación de Diseño: Módulo de Cuentas Bancarias — Workspace Unificado y Optimización de Índices

**Fecha:** 19 de Octubre de 2026  
**Rama:** `vertical/supermercado`  
**Objetivo:** Transformar el módulo de Bancos en un espacio de trabajo continuo, intuitivo y sin saltos entre pestañas desconectadas, manteniendo prominentemente los nicknames/alias de cada cuenta y optimizando las consultas de base de datos con índices especializados.

---

## 1. Problema Actual
1. **Idas y Vueltas en UI**: El usuario hace clic en una cuenta en la pestaña "Posición & Cuentas", pero los movimientos están en la pestaña "Extractos & Movimientos", la conciliación en "Conciliación Inteligente" y los cheques en "Cartera de Cheques". Cada cambio de pestaña requiere scroll y re-selección manual de cuentas.
2. **Acciones Descontextualizadas**: Los modales de importación, transferencias y depósitos de bóveda obligan al usuario a elegir la cuenta bancaria nuevamente desde un selector desplegable.
3. **Lentitud en Consultas**: La tabla `bank_transactions` carece de índices compuestos sobre `(bank_account_id, fecha DESC)` y `(company_id, conciliado)`, obligando a PostgreSQL a ejecutar escaneos secuenciales y ordenamientos costosos.

---

## 2. Enfoque A: Workspace Maestro-Detalle Unificado

### 2.1 Selector de Cuentas Superior (Cockpit Visual con Nicknames)
- **Visualización de Cuentas**: Grid/carrusel superior con tarjetas compactas y elegantes para cada cuenta.
- **Nickname Prominente**:
  - Cada tarjeta destaca en primer lugar el **Alias / Nickname** (ej: `INTERFISA CTA CTE`, `CONTINENTAL AHORRO PIX`) con badge temático y tipografía visible.
  - Subtítulo con Nombre Oficial del Banco (`Banco Interfisa S.A.E.C.A.`), tipo de cuenta (`Corriente` / `Ahorro`) y número de cuenta con máscara.
  - Monto de **Saldo Actual** en guaraníes o divisa correspondiente con formato canónico (`formatGs`).
  - Badge de estado: cantidad de movimientos pendientes de conciliar.
- **Interacción con 1 Clic**: Al pulsar una tarjeta, se establece como la `cuenta activa` y su espacio de trabajo se despliega inmediatamente debajo sin cambiar de página ni perder contexto.

### 2.2 Espacio de Trabajo de la Cuenta Activa
Directamente debajo de la cuenta seleccionada se ubica su panel operativo:

1. **Barra de Acciones Rápidas Contextuales**:
   - `📥 Importar Extracto (PDF / Excel)`: Abre el modal preconfigurado con la cuenta activa.
   - `⚡ Auto-Conciliar Inteligente`: Ejecuta la detección en lote y abre el asistente de aprobación con 1 clic para la cuenta activa.
   - `💸 Transferencia / Comisión`: Preconfigura la cuenta activa como origen o destino.
   - `🏦 Depositar de Bóveda`: Preconfigura la cuenta activa como cuenta receptora del efectivo.
   - `✍️ Emitir Cheque`: Precarga la chequera de la cuenta activa.

2. **Vistas Internas Fluidas de la Cuenta**:
   - **Vista 1: Extracto & Movimientos (Principal)**:
     - Filtros rápidos por botón tipo chip: `Todos`, `Pendientes (X)`, `Conciliados (Y)`, `Cheques Girados`.
     - Búsqueda en vivo (descripción, referencia, monto).
     - Rango de fechas rápido (Mes actual, Últimos 30 días, Rango personalizado).
     - En cada fila de movimiento:
       * Indicador visual claro: Verde con check si está conciliado, Ámbar con botón `Buscar Coincidencia` si está pendiente.
       * Si fue conciliado con cheque o factura: enlace visual directo al comprobante con opción de `Desvincular` para corregir errores.
   - **Vista 2: Cheques Girados sobre esta Cuenta**:
     - Listado de cheques emitidos específicamente contra esta cuenta bancaria.
     - Columnas: N° Cheque, Beneficiario, Vencimiento / Pago, Monto, Estado (`cobrado`, `entregado`, `pendiente`, `anulado`).
     - Impacto proyectado: Saldo en banco - Cheques en tránsito = Saldo Real Proyectado.
   - **Vista 3: Configuración & Auditoría de la Cuenta**:
     - Edición de alias/nickname, umbral de alerta de saldo mínimo, y solicitud de corrección de saldo.

### 2.3 Sección Global Consolidada
Para auditoría gerencial y visión macro:
- Gráfico histórico consolidado de Posición de Caja.
- Bandeja de Solicitudes de Corrección de Saldo pendientes de aprobación.

---

## 3. Optimización de Base de Datos (PostgreSQL & Alembic)

Se agregarán los siguientes índices especializados para garantizar tiempos de respuesta inferiores a 20ms:
1. `bank_transactions`:
   - `ix_bank_transactions_acct_fecha`: `(bank_account_id, fecha DESC)` — Acelera listados y paginación de movimientos.
   - `ix_bank_transactions_company_conciliado`: `(company_id, conciliado)` — Acelera métricas del dashboard y conteo de pendientes.
   - `ix_bank_transactions_cheque_id`: `(cheque_id) WHERE cheque_id IS NOT NULL` — Acelera el cruce con cheques y verificación de estados.
   - `ix_bank_transactions_invoice_id`: `(invoice_id) WHERE invoice_id IS NOT NULL` — Acelera cruce con facturas de proveedores.
2. `vault_entries`:
   - `ix_vault_entries_company_estado_monto`: `(company_id, estado, monto_pyg)` — Acelera la búsqueda de depósitos de recaudación en el asistente de conciliación.

---

## 4. Plan de Validación y Despliegue Zero-Downtime
1. Crear y ejecutar migración de Alembic para los índices.
2. Refactorizar `BancosPage.tsx` manteniendo los componentes y modales existentes, organizados bajo el cockpit y el espacio de trabajo contextual.
3. Verificar compilación en `ui-web` (`npm run build`) y sintaxis backend (`py_compile`).
4. Desplegar en producción con `deploy-ui.sh` y `deploy-api.sh` sin interrupción operativa para las cajas físicas.
