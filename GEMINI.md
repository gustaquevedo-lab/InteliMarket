# REGLAS DEL PROYECTO INTELIMARKET (RAMA: vertical/supermercado)

> [!IMPORTANT]
> **ESTE REPOSITORIO Y SESIÓN PERTENECEN EXCLUSIVAMENTE A LA VERTICAL DE SUPERMERCADO (EXTRA SUPERMERCADO).**

---

## 🚫 PROHIBICIONES Y REGLAS ESTRICTAS
1. **NO TOCAR POS NI ELECTRON:** Está terminantemente prohibido modificar, sobrescribir o tocar cualquier archivo de `POS` (`ui-web/src/pages/pos/`) o `Electron` (`electron/`, `main.js`, `main.cjs`, `preload.js`, `preload.cjs`). Cualquier interacción requiere advertencia seria previa y autorización expresa del usuario.
2. **EXCLUSIVAMENTE SUPERMERCADO (EXTRA SUPERMERCADO):** Olvidar por completo la rama distribuidora, Casa Gonzalito y servidores de terceros (como minisforum). Solo se trabaja la vertical de Supermercado con la VM `intellihouse@192.168.0.10` (Tailscale `100.83.91.76`).
3. **NO MEZCLAR DATOS NI VARIABLES:** Toda la interfaz, reportes, datos fiscales (RUC `80150377-9` / Razón Social `GRUPO SANTA TERESA E.A.S.` / Nombre Fantasía `Extra Supermercado Mayorista` / Timbrado `18545636`) y reglas de negocio deben responder a la vertical de Retail & Supermercado.
4. **BLINDAJE DE GIT Y RAMAS (NUNCA STASH A CIEGAS NI CAMBIO DE RAMAS):**
   - La rama activa de trabajo es SIEMPRE `vertical/supermercado` sincronizada con `origin/vertical/supermercado`.
   - Está terminantemente PROHIBIDO ejecutar `git checkout` a otras ramas o hacer `git stash` de cambios sin confirmación previa del usuario.
   - Todo trabajo estable debe consolidarse con commits explícitos (`git commit`), nunca dejarse flotando en el stash.
   - Al iniciar cualquier tarea, se debe verificar que `HEAD` coincida con el último commit de `origin/vertical/supermercado`.
