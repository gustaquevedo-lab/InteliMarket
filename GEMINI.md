# REGLAS DEL PROYECTO INTELIMARKET (RAMA: vertical/distribuidora)

> [!IMPORTANT]
> **ESTE DIRECTORIO Y SESIÓN PERTENECEN EXCLUSIVAMENTE A LA VERTICAL DE DISTRIBUIDORA (CASA GONZALITO).**

---

## 🚫 PROHIBICIONES Y REGLAS ESTRICTAS
1. **EXCLUSIVAMENTE DISTRIBUIDORA:** Este directorio de trabajo está fijado permanentemente a la rama `vertical/distribuidora`. No tocar datos ni reglas de la vertical de Supermercado.
2. **BLINDAJE DE GIT (NUNCA STASH A CIEGAS NI CAMBIO DE RAMAS):**
   - La rama activa de trabajo es SIEMPRE `vertical/distribuidora` sincronizada con `origin/vertical/distribuidora`.
   - PROHIBIDO ejecutar `git checkout` a otras ramas o hacer `git stash` de cambios. Todo trabajo se commitea explícitamente con `git commit`.
3. **BLINDAJE GRANÍTICO DE DASHBOARD Y SIDEBAR (INTOCABLES):**
   - El **Dashboard de Distribuidora** (`ui-web/src/pages/Dashboard.tsx`) y el **Sidebar de Distribuidora** (`ui-web/src/components/Layout.tsx`) son estructuras **GRANÍTICAS DEFINITIVAS**.
   - Queda estrictamente PROHIBIDO modificar, reemplazar, resetear o sobreescribir el diseño, cálculo de números, series de Pacing, tarjetas hero o estructura de navegación del Dashboard o Sidebar sin **ADVERTIR EXPLÍCITAMENTE AL USUARIO Y OBTENER SU AUTORIZACIÓN DIRECTA PREVIA**.

---

## ⚡ METODOLOGÍA SUPERPOWERS Y SKILLS
- **Rutas de Especificaciones y Planes:**
  - Specs: `docs/superpowers/specs/YYYY-MM-DD-<nombre>.md`
  - Implementation Plans: `docs/superpowers/plans/YYYY-MM-DD-<nombre>.md`
- **Skills del Workspace:** Ubicadas en `.agents/skills/` (incluyendo `superpowers:*`, `ui-ux-pro-max`, `design-system`, `ui-ux`, etc.).
- **Flujo de Trabajo:**
  - Brainstorming previo ante nuevas características (`superpowers:brainstorming`).
  - Planes de tareas atómicas TDD (`superpowers:writing-plans`).
  - Depuración estructurada con hipótesis y evidencia antes de parches (`superpowers:systematic-debugging`).
  - Verificación estricta de compilación y pruebas antes de declarar tareas completadas (`superpowers:verification-before-completion`).

