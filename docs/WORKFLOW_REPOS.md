# Workflow de repos por vertical — leer esto primero

Si estás retomando este proyecto en una sesión nueva (Claude Code u otra), este documento explica cómo está organizado el trabajo entre verticales. Léelo antes de tocar migraciones, `main.py`, o modelos compartidos.

## Contexto de negocio

InteliMarket es un ERP SaaS. La empresa dueña opera dos negocios reales que son clientes piloto simultáneos:

- **Distribuidora** — cliente piloto, servidor on-premise `minisforum-ia` (Minisforum X1 Lite).
- **Supermercado** — cliente piloto (ex-usuario de un sistema legacy llamado "Ñemuha"/ConceptoComercial/FlexPDV), servidor on-premise `intelimarket-ia` (VM Tailscale, IP `100.83.91.76`).

**El Supermercado es propiedad de la misma empresa dueña de la Distribuidora.** El objetivo final del producto (no solo de estos dos pilotos) es integrar los datos e información de ambas verticales en **un solo panel para los dueños**, con agentes IA que expongan esa información y conversen con ellos sobre cómo va el negocio y cómo mejorar. La integración es a nivel de **panel/agente central**, no de proceso o deployment compartido — cada vertical sigue corriendo on-premise, en su propio servidor, de forma independiente.

## Por qué se separó en ramas (2026-07-25)

Hasta esta fecha, dos sesiones de Claude Code trabajaban en paralelo sobre el **mismo working tree local** (`~/OneDrive-Personal/Dev/Intelimarket` en la Mac de Gustavo), sin commits intermedios. Esto causó una colisión real: dos migraciones Alembic distintas agregando la misma columna `is_superadmin` en paralelo, generando `DuplicateColumnError`.

Investigando más a fondo (ver mensaje de la sesión "Setup inicial" / Distribuidora del 2026-07-25), se confirmó una asimetría importante entre nodos:

- **Supermercado (`intelimarket-ia`)**: Alembic corre de verdad contra la base real (`alembic upgrade <revision>` ejecutado en la VM). Las migraciones son el mecanismo real de sync de schema.
- **Distribuidora (`minisforum-ia`)**: `alembic.ini` apuntaba a paths de Docker Compose (`/app/api/alembic`, host `db`) que no existen en ese despliegue bare-metal. El schema se armó a mano vía `psql` (ALTER TABLE / backfills directos). Los archivos de migración ahí son más bien documentación de intención que un mecanismo ejecutado.

Dado esto, y que ambas verticales **nunca van a correr en el mismo deployment**, se decidió:

1. **No** extraer un paquete "core" compartido todavía. El feature-gating por tenant (`api/src/verticals/presets.py`, `hasFeature`, menú en `ui-web/src/components/Layout.tsx`) ya está diseñado para que ambas verticales convivan en un mismo codebase activando/desactivando funciones. Partirlo en un paquete versionado antes de tener límites claros generaría más fricción que la que resuelve.
2. **Sí** separar el trabajo día a día en dos ramas de git, cada servidor trabajando sobre la suya, en vez de compartir un único working tree sin aislamiento.

## Cómo trabajar de acá en adelante

- Repo: `https://github.com/gustaquevedo-lab/InteliMarket` (remote `origin`).
- `main` — snapshot base + lo que sea genuinamente core y ya validado en ambas verticales (auth, tenants, features/plans, financial base). Cambios a estos módulos se piensan dos veces antes de mergear a `main`, porque los heredan ambas ramas.
- `vertical/distribuidora` — todo el trabajo específico de la vertical Distribuidora, desplegado en `minisforum-ia`.
- `vertical/supermercado` — todo el trabajo específico de la vertical Supermercado, desplegado en `intelimarket-ia`. Incluye `api/src/nemuha_connector/` (conector de migración del legacy Ñemuha) y `api/src/finance_agent/` (Gerente Financiero IA).
- Cada servidor on-premise clona el repo y hace checkout de su propia rama — **ya no se comparte el directorio local de la Mac entre sesiones**. Los procesos (API, dev server de `ui-web`, etc.) corren en su propio servidor, no en la Mac.
- Antes de tocar algo que parezca "core" (auth, tenants, config base, modelos compartidos), verificar si el cambio debería ir a `main` y luego mergearse a ambas ramas, en vez de aplicarse solo en una.
- Si una sesión detecta que Alembic no está corriendo de verdad contra la DB de su nodo (como pasaba en Distribuidora), arreglar eso antes de seguir generando archivos de migración — si no, las migraciones quedan como documentación desincronizada de la realidad del schema.
- Antes de cualquier operación destructiva de git (`reset --hard`, `checkout .`, force-push) sobre estas ramas, confirmar con el usuario — afecta el trabajo de la otra vertical/sesión.

## Estado al momento de la separación

- Commit snapshot: `ebdcc09` en `main` — "WIP: snapshot antes de separar por vertical (Distribuidora / Supermercado)".
- `vertical/distribuidora` y `vertical/supermercado` creadas desde ese mismo commit el 2026-07-25.
- Pendiente (no bloqueante): auditar las ~76 migraciones Alembic que estaban sin trackear antes del snapshot, para confirmar cuáles son específicas de cada vertical y cuáles deberían vivir en `main`.
