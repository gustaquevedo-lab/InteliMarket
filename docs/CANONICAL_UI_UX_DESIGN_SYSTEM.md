# 💎 Sistema de Diseño Canónico UI/UX — InteliMarket

> [!IMPORTANT]
> **REGLA DE ORO PARA CUALQUIER AGENTE O DESARROLLADOR:**
> Este documento establece el estándar **inmutable y obligatorio** de interfaz de usuario para todos los módulos de InteliMarket.
> Queda terminantemente prohibido inventar layouts aislados, centrar pantallas con `max-w-7xl mx-auto`, o usar cabeceras planas improvisadas.
> Toda nueva pantalla o refactorización DEBE cumplir con la arquitectura visual descrita aquí.

---

## 1. Módulo de Referencia Viva
Si tenés dudas sobre cómo maquetar una cabecera, una barra de KPIs o un selector de pestañas, el código canónico de referencia es:
- **`ui-web/src/pages/sales/SalesPage.tsx`** (*Facturación & Comprobantes de Venta*)
- **`ui-web/src/pages/sales-agent/SalesAgentPage.tsx`** (*Gerente de Ventas IA*)

---

## 2. Ancho de Pantalla y Contenedor Raíz

### 🚫 Prohibición Estricta
**NUNCA** utilices clases de ancho limitado ni centrado artificial:
```tsx
// ❌ TOTALMENTE PROHIBIDO:
<div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
<div className="max-w-5xl mx-auto">
```
*Motivo:* InteliMarket es una **Torre de Control Profesional de Retail**. Limitar el ancho a 1280px deja márgenes laterales vacíos gigantescos en monitores de oficina y rompe la consistencia visual con el resto del ERP.

### ✅ Estándar Obligatorio
El contenedor raíz de cualquier página debe ocupar el ancho completo del viewport, alineado a la izquierda:
```tsx
// ✅ ESTÁNDAR CANÓNICO:
<div className="space-y-6 animate-fade-in-up pb-16">
// O bien:
<div className="space-y-6 pb-20 max-w-full overflow-hidden">
```

---

## 3. Luxury Command Deck Header (Cabecera Sagrada)

Toda pantalla insignia o módulo de Gerente IA inicia con un **Luxury Command Deck Header**:

```tsx
{/* 🌟 LUXURY COMMAND DECK HEADER */}
<div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
  {/* Iluminación ambiental difusa en esquinas */}
  <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
  <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

  <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {/* Bloque de Icono con Badge Pulsante */}
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <IconoPrincipal className="w-7 h-7" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
          </span>
        </div>

        <div>
          {/* Sub-badge superior en mayúsculas */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
              INTELIGENCIA ARTIFICIAL · TORRE DE CONTROL
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Estado / Meta activa
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
            Nombre del Módulo
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Descripción clara de la función ejecutiva o auditoría del módulo
          </p>
        </div>
      </div>

      {/* Micro-pills de Estado y Contexto de la Empresa */}
      <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
        <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
          🏢 Extra Supermercado (Central)
        </span>
        <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
          ⚡ Motor IA / Estado
        </span>
        <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
          📊 Métricas de escala real
        </span>
      </div>
    </div>

    {/* Acciones del Header (a la derecha) */}
    <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
      {/* Selector de Período / Filtro Rápido */}
      <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-700/80 text-xs">
        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
        <select className="bg-transparent border-none text-slate-200 font-bold focus:ring-0 cursor-pointer text-xs">
          <option value="mes_actual">Mes en Curso (MTD)</option>
          <option value="mes_anterior">Mes Anterior</option>
        </select>
      </div>

      {/* Botón de Acción Principal con Degradado */}
      <button className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 border border-indigo-400/40 shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer">
        <Plus className="w-4 h-4 text-white" />
        Acción Principal
      </button>
    </div>
  </div>

  {/* 📊 BARRA DE KPIS EJECUTIVOS INTEGRADA AL HEADER */}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
    <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">KPI Principal</span>
        <span className="text-[10px] font-bold text-emerald-400">Total</span>
      </div>
      <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
        {formatPYG(monto)}
      </p>
      <p className="text-[11px] text-slate-400 font-mono">Detalle o sub-métrica</p>
    </div>
    {/* ... 3 KPIs adicionales */}
  </div>
</div>
```

---

## 4. Barra Glassmorphism de Pestañas (Pill Bar)

Cuando un módulo contiene pestañas o subsecciones:
```tsx
{/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
<div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
  {tabs.map((t) => {
    const Icon = t.icon
    const isActive = activeTab === t.id
    return (
      <button
        key={t.id}
        onClick={() => setActiveTab(t.id)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
          isActive
            ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
        }`}
      >
        <Icon className="w-4 h-4" />
        <span>{t.label}</span>
        {t.count !== undefined && (
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            isActive
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
          }`}>
            {t.count}
          </span>
        )}
      </button>
    )
  })}
</div>
```

---

## 5. Tarjetas y Superficies Internas

1. **Cards:**
   `bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm`
2. **Barra de Búsqueda y Filtros:**
   `bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3`
3. **Tablas:**
   - Cabecera: `text-[10px] font-extrabold text-slate-400 uppercase tracking-wider p-3 bg-slate-50 dark:bg-slate-950/60`
   - Celdas: `p-3.5 border-b border-slate-100 dark:border-slate-800/60 text-xs`
   - Montos monetarios: siempre alineados a la derecha (`text-right`) con fuente mono (`font-mono font-bold`) y formateados con `formatPYG()`.

---

## 6. Manejo de Errores y Resiliencia en Frontend

- **Aislamiento de Cargas:** Nunca encadenes llamadas secundarias (como reglas de negocio o catálogos) dentro del mismo bloque `try/catch` que la carga principal de datos. Si una falla, no debe bloquear la renderización de la pantalla.
- **Toasts Informativos:** Todo `toast.error` debe pasar el detalle del mensaje (`e?.message || "Detalle..."`) y nunca mostrar toasts mudos genéricos.

---

## 7. Arquitectura Canónica de Modales (Anti-Desborde y Scroll Sagrado)

Todo diálogo o modal emergente en InteliMarket DEBE garantizar que los botones de acción nunca queden sepultados o inaccesibles por el contenido:

```tsx
{/* 🪟 CONTENEDOR MODAL CANÓNICO */}
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-4xl w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
    
    {/* 1. Cabecera Fija (shrink-0) */}
    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
      <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
        <Icono className="w-5 h-5 text-indigo-500" /> Título del Modal
      </h3>
      <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400">
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* 2. Cuerpo Dinámico Scrolleable (flex-1 overflow-y-auto) */}
    <div className="p-6 space-y-4 overflow-y-auto flex-1">
      {/* Formularios, tablas, CurrencyInput, selects y listados */}
    </div>

    {/* 3. Pie de Acciones Fijo (shrink-0) */}
    <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-end gap-3 shrink-0">
      <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800">
        Cancelar
      </button>
      <button type="submit" className="btn-primary text-xs flex items-center gap-2 px-5 py-2">
        Confirmar / Guardar
      </button>
    </div>

  </div>
</div>
```

---

## 8. Botones de Acción en Tablas (Anti-Saturación & Muted Tint Standard)

### 🚫 Prohibición Estricta
**NUNCA** utilices `.btn-secondary`, `.btn-primary` con rellenos opacos masivos, ni `<button>` con fondos verdes/rojos 100% saturados dentro de celdas de tablas de datos (`<td>`).
- **Causa del desastre visual:** En InteliMarket, `.btn-secondary` inyecta `bg-secondary` (`#00a651`, verde retail vibrante de supermercado). Al usarlo en botones secundarios o de historial, tiñe la tabla de verde chillón e invisibiliza o colisiona con textos rojos o violetas.

### ✅ Estándar Canónico para Acciones de Fila
Toda celda de acciones (`<td className="p-3.5 text-right">`) debe usar micro-tintes translúcidos con bordes sutiles, o botones icon-only sobrios:

```tsx
<td className="p-3.5 text-right">
  <div className="flex items-center justify-end gap-1.5 flex-nowrap">
    {/* 1. Historial / Auditoría (Icon-only sobrio y neutral) */}
    <button
      onClick={() => handleVerHistorial(item)}
      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-700/60 transition"
      title="Ver Historial"
    >
      <History className="w-3.5 h-3.5" />
    </button>

    {/* 2. Acción Positiva Principal (Compensar, Efectivizar, Aprobar) */}
    <button
      onClick={() => handlePositiveAction(item)}
      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition flex items-center gap-1"
    >
      <Check className="w-3 h-3" />Compensó
    </button>

    {/* 3. Acción de Flujo / Workflow (Entregar, Reasignar, Transferir) */}
    <button
      onClick={() => handleFlowAction(item)}
      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition flex items-center gap-1"
    >
      <ArrowUpRight className="w-3 h-3" />Entregar
    </button>

    {/* 4. Acción de Alerta / Rechazo */}
    <button
      onClick={() => handleRejectAction(item)}
      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition"
    >
      Rechazar
    </button>

    {/* 5. Acción Destructiva / Anulación (Discreta, no chillona) */}
    <button
      onClick={() => handleCancelAction(item)}
      className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-slate-700/60 hover:border-amber-500/30 transition flex items-center gap-1"
    >
      <Ban className="w-3 h-3" />Anular
    </button>
  </div>
</td>
```

