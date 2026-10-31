"""Generador de la Herramienta HTML Interactiva de Asignación de Proveedores.
Extra Supermercado — InteliMarket (vertical/supermercado)
Incluye:
- Activar / Inactivar productos en vivo con persistencia en BD y acciones en lote.
- Stock Real consolidado de la BD (con alertas para stock negativo y desglose por unidad).
- Buscador predictivo typeahead entre 489 proveedores.
- Sugerencias inteligentes de marca.
- Asignación individual y en lote con persistencia inmediata en PostgreSQL.
- Exportación SQL y CSV.
"""

import json
from pathlib import Path

DATA_FILE = Path("scripts/productos_sin_proveedor_data.json")
OUTPUT_HTML = Path("docs/PRODUCTOS_SIN_PROVEEDOR.html")
OUTPUT_HTML_ALT = Path("docs/productos-sin-proveedor.html")


def build_html():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    json_str = json.dumps(data, ensure_ascii=False)

    html = f"""<!DOCTYPE html>
<html lang="es" class="h-full bg-slate-950 text-slate-100">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Asignación de Proveedores & Stock Real — Extra Supermercado</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {{
      darkMode: 'class',
      theme: {{
        extend: {{
          colors: {{
            brand: {{
              50: '#f0fdf4',
              500: '#22c55e',
              600: '#16a34a',
              700: '#15803d',
              900: '#14532d',
            }}
          }}
        }}
      }}
    }}
  </script>
  <style>
    ::-webkit-scrollbar {{ width: 8px; height: 8px; }}
    ::-webkit-scrollbar-track {{ background: #090d16; }}
    ::-webkit-scrollbar-thumb {{ background: #1e293b; border-radius: 4px; }}
    ::-webkit-scrollbar-thumb:hover {{ background: #334155; }}

    .dropdown-menu {{
      max-height: 280px;
      overflow-y: auto;
    }}
    .toast {{
      animation: slideIn 0.25s ease-out forwards;
    }}
    @keyframes slideIn {{
      from {{ transform: translateY(100%); opacity: 0; }}
      to {{ transform: translateY(0); opacity: 1; }}
    }}
  </style>
</head>
<body class="h-full flex flex-col bg-slate-950 text-slate-100 antialiased font-sans">

  <!-- DATA EMBEDDED DIRECTLY FOR OFFLINE / INSTANT ACCESS -->
  <script id="embedded-data" type="application/json">
{json_str}
  </script>

  <!-- NAVBAR SUPERIOR -->
  <header class="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      
      <!-- Brand & Title -->
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xl shadow-inner">
          🛒
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base sm:text-lg font-bold text-white tracking-tight">Gestor de Proveedores & Stock</h1>
            <span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
              Productos Sin Proveedor
            </span>
          </div>
          <p class="text-xs text-slate-400">Extra Supermercado Mayorista · Catálogo Comercial en Vivo</p>
        </div>
      </div>

      <!-- Connection Status & Top Actions -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Badge de Conexión -->
        <button id="btn-connection" onclick="openSettingsModal()" class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs transition">
          <span id="conn-dot" class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span id="conn-label" class="text-slate-300 font-medium">API Conectada</span>
          <span class="text-slate-500 text-[10px]">⚙️</span>
        </button>

        <!-- Recargar desde servidor -->
        <button onclick="reloadFromServer()" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition" title="Refrescar catálogo y stock desde la BD en vivo">
          <svg id="reload-svg" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </button>

        <!-- Exportar SQL -->
        <button onclick="openSqlModal()" class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-medium transition">
          <span>📜</span>
          <span>Ver / Exportar SQL</span>
        </button>

        <!-- Exportar CSV -->
        <button onclick="exportToCsv()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition" title="Descargar como CSV">
          <span>📥</span>
          <span class="hidden md:inline">CSV</span>
        </button>
      </div>

    </div>
  </header>

  <!-- CONTENEDOR PRINCIPAL -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

    <!-- BANNER EXPLICATIVO DE PERSISTENCIA Y FUNCIONAMIENTO -->
    <div class="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg shrink-0 mt-0.5">
          ⚡
        </div>
        <div class="space-y-0.5 text-xs text-slate-300">
          <p class="font-bold text-white text-sm">
            Persistencia Inmediata en Base de Datos PostgreSQL
          </p>
          <p>
            Al pulsar <b>Guardar</b> o cambiar el switch <b>Activo / Inactivo</b>, la base de datos se actualiza directamente en tiempo real.
            No requiere reiniciar servicios ni compilar; queda asociado de inmediato para <b>Órdenes de Compra, Recepciones, Sugeridos de Reposición y Reportes del ERP</b>.
          </p>
        </div>
      </div>
      <div class="shrink-0 flex items-center gap-2 text-xs">
        <label class="flex items-center gap-2 cursor-pointer bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 hover:border-slate-600 transition">
          <input type="checkbox" id="chk-hide-assigned" onchange="toggleHideAssigned(this.checked)" class="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer">
          <span class="text-slate-300 font-medium">Ocultar ya asignados</span>
        </label>
      </div>
    </div>

    <!-- KPI CARDS -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <!-- Total sin proveedor -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
        <span class="text-xs font-medium text-slate-400">Total Sin Proveedor</span>
        <div class="flex items-baseline justify-between mt-1">
          <span id="kpi-total" class="text-2xl font-black text-white font-mono">0</span>
          <span class="text-[11px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">Catálogo</span>
        </div>
      </div>

      <!-- Activos -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm cursor-pointer hover:border-emerald-500/40 transition" onclick="setQuickFilter('activos')">
        <span class="text-xs font-medium text-slate-400">Activos en Venta</span>
        <div class="flex items-baseline justify-between mt-1">
          <span id="kpi-activos" class="text-2xl font-black text-emerald-400 font-mono">0</span>
          <span class="text-[11px] text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">Habilitados</span>
        </div>
      </div>

      <!-- Inactivos -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm cursor-pointer hover:border-slate-700 transition" onclick="setQuickFilter('inactivos')">
        <span class="text-xs font-medium text-slate-400">Inactivos</span>
        <div class="flex items-baseline justify-between mt-1">
          <span id="kpi-inactivos" class="text-2xl font-black text-slate-400 font-mono">0</span>
          <span class="text-[11px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Deshabilitados</span>
        </div>
      </div>

      <!-- Con Stock Positivo -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm cursor-pointer hover:border-cyan-500/40 transition" onclick="setQuickFilter('stock_positivo')">
        <span class="text-xs font-medium text-slate-400">Stock &gt; 0</span>
        <div class="flex items-baseline justify-between mt-1">
          <span id="kpi-stock-pos" class="text-2xl font-black text-cyan-400 font-mono">0</span>
          <span class="text-[11px] text-cyan-400/80 bg-cyan-500/10 px-1.5 py-0.5 rounded">Físico</span>
        </div>
      </div>

      <!-- Stock Negativo (Ventas sin Factura de Compra) -->
      <div class="bg-slate-900/70 border border-rose-900/40 rounded-xl p-3.5 flex flex-col justify-between shadow-sm cursor-pointer hover:border-rose-500/40 transition" onclick="setQuickFilter('stock_negativo')" title="Productos que registran ventas pero no tienen factura de compra ingresada">
        <span class="text-xs font-medium text-rose-400">Stock Negativo (&lt; 0)</span>
        <div class="flex items-baseline justify-between mt-1">
          <span id="kpi-stock-neg" class="text-2xl font-black text-rose-400 font-mono">0</span>
          <span class="text-[11px] text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded font-bold">⚠️ Regularizar</span>
        </div>
      </div>

      <!-- Asignados en Sesión -->
      <div class="bg-slate-900/70 border border-emerald-900/40 rounded-xl p-3.5 flex flex-col justify-between shadow-sm bg-gradient-to-br from-slate-900/80 to-emerald-950/30">
        <span class="text-xs font-medium text-emerald-400">Asignados Hoy</span>
        <div class="flex items-baseline justify-between mt-1">
          <span id="kpi-asignados" class="text-2xl font-black text-emerald-400 font-mono">0</span>
          <span class="text-[11px] text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded font-bold">Guardados</span>
        </div>
      </div>
    </div>

    <!-- BARRA DE CONTROLES Y FILTROS -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
        
        <!-- Buscador -->
        <div class="md:col-span-5 relative">
          <input 
            type="text" 
            id="search-input"
            oninput="handleSearch(this.value)"
            placeholder="Buscar por Nombre, SKU o Código de Barra (ej: TRENTO, 124390, 789...)" 
            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          >
          <svg class="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <button id="clear-search" onclick="clearSearch()" class="hidden absolute right-3 top-3 text-slate-500 hover:text-slate-300 text-xs">✕</button>
        </div>

        <!-- Filtro Estado -->
        <div class="md:col-span-2">
          <select id="filter-estado" onchange="applyFilters()" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500">
            <option value="todos">Estado: Todos</option>
            <option value="activo" selected>Solo Activos</option>
            <option value="inactivo">Solo Inactivos</option>
            <option value="asignados">Asignados en sesión</option>
            <option value="pendientes">Pendientes de asignar</option>
          </select>
        </div>

        <!-- Filtro Stock Real -->
        <div class="md:col-span-2">
          <select id="filter-stock" onchange="applyFilters()" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500">
            <option value="todos">Stock: Todos</option>
            <option value="positivo">Stock &gt; 0 (Positivo)</option>
            <option value="negativo">⚠️ Stock &lt; 0 (Negativo)</option>
            <option value="cero">Stock = 0</option>
          </select>
        </div>

        <!-- Filtro Categoría -->
        <div class="md:col-span-3">
          <select id="filter-categoria" onchange="applyFilters()" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500">
            <option value="todas">Categoría: Todas</option>
          </select>
        </div>

      </div>

      <!-- Fila de Filtros Rápidos (Chips) & Ordenación -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
        
        <!-- Quick Chips -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-slate-500 text-[11px] mr-1">Rápido:</span>
          <button onclick="setQuickFilter('activos')" class="px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/40 transition">
            Activos
          </button>
          <button onclick="setQuickFilter('inactivos')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
            Inactivos
          </button>
          <button onclick="setQuickFilter('stock_negativo')" class="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/40 transition">
            ⚠️ Stock Negativo (54)
          </button>
          <button onclick="setQuickFilter('con_sugerencia')" class="px-2.5 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 border border-purple-800/40 transition">
            ✨ Con Sugerencia de Marca
          </button>
          <button onclick="setQuickFilter('panificados')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
            🍞 Panificados Extra
          </button>
          <button onclick="setQuickFilter('todos')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
            Ver Todos
          </button>
        </div>

        <!-- Ordenación -->
        <div class="flex items-center gap-2">
          <span class="text-slate-500 text-[11px]">Ordenar por:</span>
          <select id="sort-select" onchange="applyFilters()" class="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500">
            <option value="stock_asc">Stock Menor → Mayor (Ver Negativos Primero)</option>
            <option value="stock_desc">Stock Mayor → Menor</option>
            <option value="nombre_asc">Nombre A → Z</option>
            <option value="sku_asc">SKU (Código Interno)</option>
            <option value="precio_desc">Mayor Precio Venta</option>
            <option value="costo_desc">Mayor Costo Promedio</option>
          </select>
        </div>

      </div>
    </div>

    <!-- ACCIONES EN LOTE FLOTANTE (SE ACTIVA AL SELECCIONAR) -->
    <div id="bulk-toolbar" class="hidden bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
      <div class="flex items-center gap-3">
        <span class="flex h-3 w-3 relative">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        <span class="text-sm font-bold text-white"><span id="selected-count">0</span> seleccionados</span>
        <button onclick="selectAllVisible()" class="text-xs text-emerald-400 hover:underline">Seleccionar visibles</button>
        <button onclick="deselectAll()" class="text-xs text-slate-400 hover:underline">Desmarcar</button>
      </div>

      <!-- Acciones de Estado y Proveedor -->
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Activar / Inactivar Masivo -->
        <button onclick="setBulkActiveState(true)" class="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-xs font-semibold transition flex items-center gap-1.5" title="Activar todos los seleccionados en la base de datos">
          <span>✅</span>
          <span>Activar</span>
        </button>
        <button onclick="setBulkActiveState(false)" class="px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 text-xs font-semibold transition flex items-center gap-1.5" title="Inactivar todos los seleccionados en la base de datos">
          <span>⏸️</span>
          <span>Inactivar</span>
        </button>

        <span class="text-slate-600">|</span>

        <button onclick="applySuggestionsToSelected()" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition flex items-center gap-1.5">
          <span>✨</span>
          <span>Aplicar Sugerencias</span>
        </button>

        <div class="relative w-56">
          <input 
            type="text" 
            id="bulk-supplier-search"
            placeholder="Proveedor en lote..."
            oninput="handleBulkSupplierSearch(this.value)"
            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          >
          <div id="bulk-supplier-dropdown" class="dropdown-menu hidden absolute bottom-full left-0 right-0 mb-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1">
            <!-- Dynamic suppliers list -->
          </div>
        </div>

        <button id="btn-bulk-apply" onclick="applyBulkSupplier()" disabled class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold transition shadow">
          Asignar
        </button>
      </div>
    </div>

    <!-- TABLA DE PRODUCTOS -->
    <div class="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      
      <!-- Table Header Status Bar -->
      <div class="px-4 py-3 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div class="flex items-center gap-3">
          <input type="checkbox" id="check-all" onchange="toggleSelectAll(this.checked)" class="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer">
          <span id="results-count" class="font-medium text-slate-200">Mostrando 0 productos</span>
        </div>
        <div class="flex items-center gap-2">
          <span>Paginación:</span>
          <select id="page-size-select" onchange="changePageSize(this.value)" class="bg-slate-950 border border-slate-700 rounded-md px-2 py-0.5 text-xs text-slate-300">
            <option value="50">50 por pág.</option>
            <option value="100">100 por pág.</option>
            <option value="all">Ver Todos</option>
          </select>
        </div>
      </div>

      <!-- Table responsive container -->
      <div class="overflow-x-auto min-h-[400px]">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th class="py-3 px-3 w-10 text-center">#</th>
              <th class="py-3 px-3 w-28">SKU / Barra</th>
              <th class="py-3 px-4 min-w-[260px]">Descripción / Categoría</th>
              <th class="py-3 px-3 text-right w-28 cursor-pointer hover:text-white" onclick="toggleStockSort()" title="Clic para ordenar por stock real de la BD">
                <span class="inline-flex items-center gap-1 justify-end">
                  Stock Real BD
                  <span id="stock-sort-icon">↕️</span>
                </span>
              </th>
              <th class="py-3 px-3 text-right">Costo / Venta</th>
              <th class="py-3 px-3 text-center w-36">Estado (Activar/Inactivar)</th>
              <th class="py-3 px-4 min-w-[340px]">Proveedor Asignado / Buscador</th>
            </tr>
          </thead>
          <tbody id="products-table-body" class="divide-y divide-slate-800/60 font-medium">
            <!-- Injected by JavaScript -->
          </tbody>
        </table>
      </div>

      <!-- Table Footer / Pagination -->
      <div id="pagination-bar" class="px-4 py-3 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span id="page-info">Página 1 de 1</span>
        <div class="flex items-center gap-1.5">
          <button id="btn-prev" onclick="prevPage()" class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition">
            Anterior
          </button>
          <div id="page-numbers" class="flex items-center gap-1"></div>
          <button id="btn-next" onclick="nextPage()" class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition">
            Siguiente
          </button>
        </div>
      </div>

    </div>

  </main>

  <!-- MODAL DE CONFIGURACIÓN & LOGIN -->
  <div id="settings-modal" class="hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span>⚙️</span> Configuración de Conexión API
        </h3>
        <button onclick="closeSettingsModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>

      <div class="space-y-4 text-xs">
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Servidor Backend API</label>
          <input type="text" id="cfg-api-base" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs focus:border-emerald-500">
          <span class="text-[10px] text-slate-500">Por defecto: /api o http://100.83.91.76:8000</span>
        </div>

        <div>
          <label class="block text-slate-300 font-semibold mb-1">Token de Sesión (JWT / Bearer)</label>
          <textarea id="cfg-token" rows="2" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-[11px] focus:border-emerald-500" placeholder="Auto-cargado desde localStorage si estás logueado en InteliMarket"></textarea>
        </div>

        <!-- Iniciar Sesión Rápido -->
        <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <span class="block font-bold text-slate-300 text-xs">¿Iniciar Sesión Directamente?</span>
          <div class="grid grid-cols-2 gap-2">
            <input type="text" id="login-email" placeholder="Usuario / Email" class="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs">
            <input type="password" id="login-pass" placeholder="Contraseña" class="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs">
          </div>
          <button onclick="performLogin()" class="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition">
            Iniciar Sesión y Guardar Token
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
        <button onclick="closeSettingsModal()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">
          Cerrar
        </button>
        <button onclick="saveSettings()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
          Guardar Cambios
        </button>
      </div>
    </div>
  </div>

  <!-- MODAL DE EXPORTACIÓN SQL -->
  <div id="sql-modal" class="hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span>📜</span> Sentencias SQL de Asignación & Estados
          </h3>
          <p class="text-xs text-slate-400">Actualización masiva de `products.supplier_id` y `products.activo` en PostgreSQL</p>
        </div>
        <button onclick="closeSqlModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>

      <div class="flex-1 overflow-hidden flex flex-col">
        <textarea id="sql-content" readonly class="w-full flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-emerald-400 font-mono text-[11px] leading-relaxed resize-none focus:outline-none select-all"></textarea>
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
        <span id="sql-count-label" class="text-xs text-slate-400">0 sentencias generadas</span>
        <div class="flex gap-2">
          <button onclick="copySqlToClipboard()" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition">
            📋 Copiar SQL
          </button>
          <button onclick="downloadSqlFile()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition">
            💾 Descargar .SQL
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- TOAST CONTAINER -->
  <div id="toast-container" class="fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none"></div>

  <!-- JAVASCRIPT DE LÓGICA INTERACTIVA -->
  <script>
    // --- ESTADO GLOBAL ---
    let RAW_PRODUCTS = [];
    let RAW_SUPPLIERS = [];
    let STATS = {{}};
    let filteredProducts = [];
    let selectedProductIds = new Set();
    let assignedSession = {{}}; // product_id -> {{ supplier_id, supplier_nombre, timestamp }}

    let hideAssigned = false;
    let stockSortAsc = true;
    let currentPage = 1;
    let pageSize = 50;
    let currentSearchTerm = '';

    let API_BASE = localStorage.getItem('cfg_api_base') || (window.location.origin.includes(':5173') || window.location.origin.includes('superextra') ? '/api' : 'http://100.83.91.76:8000');
    let AUTH_TOKEN = localStorage.getItem('access_token') || localStorage.getItem('station_token') || '';

    // --- INICIALIZACIÓN ---
    document.addEventListener('DOMContentLoaded', () => {{
      initData();
      checkApiConnection();
      renderAll();
    }});

    function initData() {{
      try {{
        const rawEl = document.getElementById('embedded-data');
        if (rawEl) {{
          const parsed = JSON.parse(rawEl.textContent);
          RAW_PRODUCTS = parsed.products || [];
          RAW_SUPPLIERS = parsed.suppliers || [];
          STATS = parsed.stats || {{}};
        }}
      }} catch (e) {{
        console.error('Error parseando embedded data:', e);
      }}

      // Cargar asignaciones previas de localStorage si existen
      try {{
        const cached = localStorage.getItem('intelimarket_assigned_session');
        if (cached) {{
          assignedSession = JSON.parse(cached);
          for (const pid in assignedSession) {{
            const p = RAW_PRODUCTS.find(x => x.id === pid);
            if (p) {{
              p.assigned_supplier_id = assignedSession[pid].supplier_id;
              p.assigned_supplier_nombre = assignedSession[pid].supplier_nombre;
            }}
          }}
        }}
      }} catch (e) {{}}

      populateCategoryDropdown();
      updateKpis();
    }}

    function populateCategoryDropdown() {{
      const cats = Array.from(new Set(RAW_PRODUCTS.map(p => p.categoria || 'Sin Categoría'))).sort();
      const sel = document.getElementById('filter-categoria');
      if (!sel) return;
      sel.innerHTML = '<option value="todas">Categoría: Todas</option>';
      cats.forEach(c => {{
        const cnt = RAW_PRODUCTS.filter(p => (p.categoria || 'Sin Categoría') === c).length;
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `${{c}} (${{cnt}})`;
        sel.appendChild(opt);
      }});
    }}

    function updateKpis() {{
      const total = RAW_PRODUCTS.length;
      const activos = RAW_PRODUCTS.filter(p => p.activo).length;
      const inactivos = total - activos;
      const conStockPos = RAW_PRODUCTS.filter(p => p.stock > 0).length;
      const conStockNeg = RAW_PRODUCTS.filter(p => p.stock < 0).length;
      const asignados = Object.keys(assignedSession).length;

      document.getElementById('kpi-total').textContent = total.toLocaleString('es-PY');
      document.getElementById('kpi-activos').textContent = activos.toLocaleString('es-PY');
      document.getElementById('kpi-inactivos').textContent = inactivos.toLocaleString('es-PY');
      document.getElementById('kpi-stock-pos').textContent = conStockPos.toLocaleString('es-PY');
      document.getElementById('kpi-stock-neg').textContent = conStockNeg.toLocaleString('es-PY');
      document.getElementById('kpi-asignados').textContent = asignados.toLocaleString('es-PY');
    }}

    // --- FILTRADO Y BÚSQUEDA ---
    function handleSearch(term) {{
      currentSearchTerm = term.trim().toLowerCase();
      document.getElementById('clear-search').classList.toggle('hidden', currentSearchTerm.length === 0);
      currentPage = 1;
      applyFilters();
    }}

    function clearSearch() {{
      document.getElementById('search-input').value = '';
      handleSearch('');
    }}

    function toggleHideAssigned(checked) {{
      hideAssigned = checked;
      currentPage = 1;
      applyFilters();
    }}

    function setQuickFilter(type) {{
      const est = document.getElementById('filter-estado');
      const stk = document.getElementById('filter-stock');
      const cat = document.getElementById('filter-categoria');

      if (type === 'activos') {{
        est.value = 'activo';
        stk.value = 'todos';
        cat.value = 'todas';
      }} else if (type === 'inactivos') {{
        est.value = 'inactivo';
        stk.value = 'todos';
        cat.value = 'todas';
      }} else if (type === 'stock_positivo') {{
        est.value = 'todos';
        stk.value = 'positivo';
        cat.value = 'todas';
      }} else if (type === 'stock_negativo') {{
        est.value = 'todos';
        stk.value = 'negativo';
        cat.value = 'todas';
      }} else if (type === 'con_sugerencia') {{
        est.value = 'todos';
        stk.value = 'todos';
        cat.value = 'todas';
        currentSearchTerm = '';
        document.getElementById('search-input').value = '';
        filteredProducts = RAW_PRODUCTS.filter(p => p.sugerencia);
        currentPage = 1;
        renderTable();
        return;
      }} else if (type === 'panificados') {{
        est.value = 'todos';
        stk.value = 'todos';
        cat.value = 'PANIFICADOS';
      }} else if (type === 'todos') {{
        est.value = 'todos';
        stk.value = 'todos';
        cat.value = 'todas';
        clearSearch();
        return;
      }}
      currentPage = 1;
      applyFilters();
    }}

    function toggleStockSort() {{
      stockSortAsc = !stockSortAsc;
      const sortSelect = document.getElementById('sort-select');
      sortSelect.value = stockSortAsc ? 'stock_asc' : 'stock_desc';
      document.getElementById('stock-sort-icon').textContent = stockSortAsc ? '▲' : '▼';
      applyFilters();
    }}

    function applyFilters() {{
      const estFilter = document.getElementById('filter-estado').value;
      const stkFilter = document.getElementById('filter-stock').value;
      const catFilter = document.getElementById('filter-categoria').value;
      const sortBy = document.getElementById('sort-select').value;

      filteredProducts = RAW_PRODUCTS.filter(p => {{
        // Ocultar asignados si está marcado
        if (hideAssigned && (assignedSession[p.id] || p.assigned_supplier_id)) {{
          return false;
        }}

        // Búsqueda textual
        if (currentSearchTerm) {{
          const matchSku = p.sku && p.sku.toLowerCase().includes(currentSearchTerm);
          const matchNombre = p.nombre && p.nombre.toLowerCase().includes(currentSearchTerm);
          const matchBar = p.codigo_barra && p.codigo_barra.toLowerCase().includes(currentSearchTerm);
          if (!matchSku && !matchNombre && !matchBar) return false;
        }}

        // Estado
        if (estFilter === 'activo' && !p.activo) return false;
        if (estFilter === 'inactivo' && p.activo) return false;
        if (estFilter === 'asignados' && !assignedSession[p.id]) return false;
        if (estFilter === 'pendientes' && assignedSession[p.id]) return false;

        // Stock Real BD
        if (stkFilter === 'positivo' && !(p.stock > 0)) return false;
        if (stkFilter === 'negativo' && !(p.stock < 0)) return false;
        if (stkFilter === 'cero' && !(p.stock === 0)) return false;

        // Categoría
        if (catFilter !== 'todas' && (p.categoria || 'Sin Categoría') !== catFilter) return false;

        return true;
      }});

      // Ordenar
      filteredProducts.sort((a, b) => {{
        if (sortBy === 'stock_asc') return (a.stock || 0) - (b.stock || 0);
        if (sortBy === 'stock_desc') return (b.stock || 0) - (a.stock || 0);
        if (sortBy === 'nombre_asc') return (a.nombre || '').localeCompare(b.nombre || '');
        if (sortBy === 'sku_asc') return (a.sku || '').localeCompare(b.sku || '');
        if (sortBy === 'precio_desc') return (b.precio_venta || 0) - (a.precio_venta || 0);
        if (sortBy === 'costo_desc') return (b.costo || 0) - (a.costo || 0);
        return 0;
      }});

      renderTable();
    }}

    // Formateador de stock
    function formatStock(val) {{
      const num = Number(val || 0);
      if (Math.abs(num % 1) < 0.0001) {{
        return num.toLocaleString('es-PY');
      }}
      return num.toLocaleString('es-PY', {{ minimumFractionDigits: 2, maximumFractionDigits: 3 }});
    }}

    // --- RENDERIZADO DE TABLA ---
    function renderTable() {{
      const tbody = document.getElementById('products-table-body');
      const resultsCount = document.getElementById('results-count');
      
      const totalFiltered = filteredProducts.length;
      resultsCount.textContent = `Mostrando ${{totalFiltered.toLocaleString('es-PY')}} de ${{RAW_PRODUCTS.length.toLocaleString('es-PY')}} productos`;

      if (totalFiltered === 0) {{
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="py-12 text-center text-slate-500">
              <span class="text-3xl block mb-2">🔍</span>
              No se encontraron productos con los filtros aplicados.
            </td>
          </tr>
        `;
        renderPagination(0);
        return;
      }}

      // Rango de paginación
      let start = 0;
      let end = totalFiltered;
      if (pageSize !== 'all') {{
        const ps = Number(pageSize);
        start = (currentPage - 1) * ps;
        end = Math.min(start + ps, totalFiltered);
      }}

      const pageItems = filteredProducts.slice(start, end);

      let html = '';
      pageItems.forEach((p, idx) => {{
        const globalIdx = start + idx + 1;
        const isSelected = selectedProductIds.has(p.id);
        const assigned = assignedSession[p.id];

        // Stock Real BD badge
        let stockBadge = '';
        if (p.stock > 0) {{
          stockBadge = `
            <span class="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-mono font-bold border border-emerald-500/30 whitespace-nowrap" title="Stock Físico en Depósito Central">
              +${{formatStock(p.stock)}} ${{p.unidad_medida}}
            </span>
          `;
        }} else if (p.stock < 0) {{
          stockBadge = `
            <span class="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/30 whitespace-nowrap cursor-help" title="Stock Negativo: Ventas registradas en caja POS sin ingreso previo de factura de compra">
              ⚠️ ${{formatStock(p.stock)}} ${{p.unidad_medida}}
            </span>
          `;
        }} else {{
          stockBadge = `<span class="text-slate-500 font-mono text-[11px] whitespace-nowrap">0 ${{p.unidad_medida}}</span>`;
        }}

        // Switch Interactivo Activo / Inactivo
        const estadoSwitch = `
          <div class="flex items-center justify-center gap-2">
            <button 
              type="button"
              onclick="toggleProductActive('${{p.id}}', event)" 
              id="toggle-btn-${{p.id}}"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${{p.activo ? 'bg-emerald-500' : 'bg-slate-700'}}"
              title="${{p.activo ? 'Clic para Inactivar' : 'Clic para Activar'}}"
            >
              <span class="sr-only">Estado</span>
              <span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${{p.activo ? 'translate-x-4' : 'translate-x-0'}}"></span>
            </button>
            <span id="badge-estado-${{p.id}}" class="text-[10px] font-bold w-12 text-left ${{p.activo ? 'text-emerald-400' : 'text-slate-400'}}">
              ${{p.activo ? 'ACTIVO' : 'INACTIVO'}}
            </span>
          </div>
        `;

        // Precios formateados en Guaraníes (sin decimales según regla canónica de Extra)
        const costoFmt = Math.round(p.costo || 0).toLocaleString('es-PY');
        const precioFmt = Math.round(p.precio_venta || 0).toLocaleString('es-PY');

        // Asignador / Proveedor UI
        let supplierUi = '';
        if (assigned) {{
          supplierUi = `
            <div class="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-emerald-950/40 border border-emerald-600/40">
              <div class="flex items-center gap-1.5 overflow-hidden">
                <span class="text-emerald-400 font-bold text-xs">✓</span>
                <span class="text-emerald-200 font-bold text-xs truncate" title="${{assigned.supplier_nombre}}">${{assigned.supplier_nombre}}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button onclick="clearAssignment('${{p.id}}')" class="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-[10px]" title="Desvincular proveedor">✕</button>
              </div>
            </div>
          `;
        }} else {{
          const sug = p.sugerencia;
          const sugHtml = sug ? `
            <div class="mt-1 flex items-center justify-between gap-1 p-1 rounded-lg bg-purple-950/30 border border-purple-800/40 text-[11px]">
              <span class="text-purple-300 truncate" title="Sugerido por marca: ${{sug.supplier_nombre}}">
                ✨ <b>Sugerido:</b> ${{sug.supplier_nombre}}
              </span>
              <button onclick="assignDirect('${{p.id}}', '${{sug.supplier_id}}', '${{escapeQuotes(sug.supplier_nombre)}}')" class="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] shrink-0 transition">
                Aceptar
              </button>
            </div>
          ` : '';

          supplierUi = `
            <div class="relative supplier-picker" id="picker-${{p.id}}">
              <div class="flex items-center gap-1.5">
                <input 
                  type="text" 
                  id="sup-input-${{p.id}}"
                  placeholder="Escribir para buscar proveedor..." 
                  onfocus="openSupplierDropdown('${{p.id}}')"
                  oninput="filterSupplierDropdown('${{p.id}}', this.value)"
                  class="flex-1 bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                >
              </div>
              <div id="sup-drop-${{p.id}}" class="dropdown-menu hidden absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1">
                <!-- Dropdown items dinámicos -->
              </div>
              ${{sugHtml}}
            </div>
          `;
        }}

        const rowOpacity = p.activo ? '' : 'opacity-70 bg-slate-950/40';

        html += `
          <tr id="row-${{p.id}}" class="hover:bg-slate-800/40 transition ${{rowOpacity}} ${{isSelected ? 'bg-emerald-950/20' : ''}}">
            <td class="py-2.5 px-3 text-center">
              <input type="checkbox" onchange="toggleSelectProduct('${{p.id}}', this.checked)" ${{isSelected ? 'checked' : ''}} class="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer">
            </td>
            <td class="py-2.5 px-3 font-mono">
              <span class="font-bold text-white block">${{p.sku}}</span>
              <span class="text-[10px] text-slate-500 truncate block">${{p.codigo_barra || '—'}}</span>
            </td>
            <td class="py-2.5 px-4">
              <span class="font-semibold text-slate-100 block text-xs leading-snug">${{highlightText(p.nombre, currentSearchTerm)}}</span>
              <span class="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded inline-block mt-0.5">${{p.categoria}}</span>
            </td>
            <td class="py-2.5 px-3 text-right">
              ${{stockBadge}}
            </td>
            <td class="py-2.5 px-3 text-right font-mono text-[11px]">
              <span class="text-slate-400 block" title="Costo Promedio">₲ ${{costoFmt}}</span>
              <span class="text-emerald-400 font-bold block" title="Precio Venta">₲ ${{precioFmt}}</span>
            </td>
            <td class="py-2.5 px-3 text-center">
              ${{estadoSwitch}}
            </td>
            <td class="py-2.5 px-4">
              ${{supplierUi}}
            </td>
          </tr>
        `;
      }});

      tbody.innerHTML = html;
      renderPagination(totalFiltered);
    }}

    function highlightText(text, search) {{
      if (!text || !search) return text || '';
      const regex = new RegExp(`(${{search}})`, 'gi');
      return text.replace(regex, '<span class="bg-amber-400/20 text-amber-200 font-bold rounded px-0.5">$1</span>');
    }}

    // --- ACCIÓN ACTIVAR / INACTIVAR EN VIVO ---
    async function toggleProductActive(productId, event) {{
      if (event) event.stopPropagation();
      const p = RAW_PRODUCTS.find(x => x.id === productId);
      if (!p) return;

      const newStatus = !p.activo;
      p.activo = newStatus;

      // Actualizar UI optimistamente
      const btn = document.getElementById(`toggle-btn-${{productId}}`);
      const badge = document.getElementById(`badge-estado-${{productId}}`);
      const row = document.getElementById(`row-${{productId}}`);

      if (btn) {{
        btn.className = `relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${{newStatus ? 'bg-emerald-500' : 'bg-slate-700'}}`;
        const dot = btn.querySelector('span:not(.sr-only)');
        if (dot) dot.className = `pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${{newStatus ? 'translate-x-4' : 'translate-x-0'}}`;
      }}
      if (badge) {{
        badge.textContent = newStatus ? 'ACTIVO' : 'INACTIVO';
        badge.className = `text-[10px] font-bold w-12 text-left ${{newStatus ? 'text-emerald-400' : 'text-slate-400'}}`;
      }}
      if (row) {{
        if (newStatus) row.classList.remove('opacity-70', 'bg-slate-950/40');
        else row.classList.add('opacity-70', 'bg-slate-950/40');
      }}

      updateKpis();
      showToast(`${{p.sku}} - ${{p.nombre.slice(0, 20)}} → ${{newStatus ? 'ACTIVO' : 'INACTIVO'}}`, newStatus ? 'success' : 'warn');

      // Persistir en backend API
      try {{
        const headers = {{ 'Content-Type': 'application/json' }};
        if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${{AUTH_TOKEN}}`;

        let url = `${{API_BASE}}/api/v1/products-tool/toggle-active`;
        if (API_BASE.endsWith('/api')) url = `${{API_BASE}}/v1/products-tool/toggle-active`;

        const res = await fetch(url, {{
          method: 'POST',
          headers,
          body: JSON.stringify({{ product_id: productId, activo: newStatus }})
        }});

        if (!res.ok) {{
          const fallbackUrl = API_BASE.endsWith('/api') ? `${{API_BASE}}/v1/products/toggle-active` : `${{API_BASE}}/api/v1/products/toggle-active`;
          await fetch(fallbackUrl, {{
            method: 'POST',
            headers,
            body: JSON.stringify({{ product_id: productId, activo: newStatus }})
          }});
        }}
      }} catch (err) {{
        console.warn('Error sincronizando estado activo con API:', err);
      }}
    }}

    // Activar / Inactivar masivo
    async function setBulkActiveState(newStatus) {{
      if (selectedProductIds.size === 0) return;
      const pids = Array.from(selectedProductIds);

      pids.forEach(pid => {{
        const p = RAW_PRODUCTS.find(x => x.id === pid);
        if (p) p.activo = newStatus;
      }});

      updateKpis();
      renderTable();
      showToast(`${{pids.length}} productos cambiados a ${{newStatus ? 'ACTIVO' : 'INACTIVO'}}`, newStatus ? 'success' : 'warn');

      // Persistir cada uno en background
      for (const pid of pids) {{
        try {{
          const headers = {{ 'Content-Type': 'application/json' }};
          if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${{AUTH_TOKEN}}`;
          let url = `${{API_BASE}}/api/v1/products-tool/toggle-active`;
          if (API_BASE.endsWith('/api')) url = `${{API_BASE}}/v1/products-tool/toggle-active`;

          fetch(url, {{
            method: 'POST',
            headers,
            body: JSON.stringify({{ product_id: pid, activo: newStatus }})
          }}).catch(() => {{}});
        }} catch (e) {{}}
      }}
    }}

    // --- PAGINACIÓN ---
    function renderPagination(totalFiltered) {{
      const paginationBar = document.getElementById('pagination-bar');
      if (pageSize === 'all' || totalFiltered <= Number(pageSize)) {{
        paginationBar.classList.add('hidden');
        return;
      }}
      paginationBar.classList.remove('hidden');

      const ps = Number(pageSize);
      const totalPages = Math.ceil(totalFiltered / ps);
      currentPage = Math.max(1, Math.min(currentPage, totalPages));

      document.getElementById('page-info').textContent = `Página ${{currentPage}} de ${{totalPages}} (${{totalFiltered.toLocaleString('es-PY')}} items)`;
      document.getElementById('btn-prev').disabled = currentPage <= 1;
      document.getElementById('btn-next').disabled = currentPage >= totalPages;

      const pageNumContainer = document.getElementById('page-numbers');
      let pBtns = '';
      for (let i = 1; i <= totalPages; i++) {{
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {{
          pBtns += `
            <button onclick="goToPage(${{i}})" class="w-7 h-7 rounded-lg text-xs font-semibold ${{i === currentPage ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}} transition">
              ${{i}}
            </button>
          `;
        }} else if (i === currentPage - 3 || i === currentPage + 3) {{
          pBtns += `<span class="text-slate-600 text-xs px-0.5">...</span>`;
        }}
      }}
      pageNumContainer.innerHTML = pBtns;
    }}

    function changePageSize(size) {{
      pageSize = size;
      currentPage = 1;
      renderTable();
    }}

    function prevPage() {{
      if (currentPage > 1) {{
        currentPage--;
        renderTable();
      }}
    }}

    function nextPage() {{
      const totalPages = Math.ceil(filteredProducts.length / Number(pageSize));
      if (currentPage < totalPages) {{
        currentPage++;
        renderTable();
      }}
    }}

    function goToPage(page) {{
      currentPage = page;
      renderTable();
    }}

    // --- SELECCIÓN MÚLTIPLE / LOTE ---
    function toggleSelectProduct(productId, isChecked) {{
      if (isChecked) selectedProductIds.add(productId);
      else selectedProductIds.delete(productId);
      updateBulkToolbar();
    }}

    function toggleSelectAll(isChecked) {{
      filteredProducts.forEach(p => {{
        if (isChecked) selectedProductIds.add(p.id);
        else selectedProductIds.delete(p.id);
      }});
      updateBulkToolbar();
      renderTable();
    }}

    function selectAllVisible() {{
      filteredProducts.forEach(p => selectedProductIds.add(p.id));
      updateBulkToolbar();
      renderTable();
    }}

    function deselectAll() {{
      selectedProductIds.clear();
      document.getElementById('check-all').checked = false;
      updateBulkToolbar();
      renderTable();
    }}

    function updateBulkToolbar() {{
      const toolbar = document.getElementById('bulk-toolbar');
      const countEl = document.getElementById('selected-count');
      const count = selectedProductIds.size;
      countEl.textContent = count;
      toolbar.classList.toggle('hidden', count === 0);
    }}

    // --- ASIGNACIÓN DE PROVEEDORES ---
    function openSupplierDropdown(productId) {{
      const drop = document.getElementById(`sup-drop-${{productId}}`);
      if (!drop) return;
      filterSupplierDropdown(productId, '');
      drop.classList.remove('hidden');

      const clickHandler = (e) => {{
        if (!e.target.closest(`#picker-${{productId}}`)) {{
          drop.classList.add('hidden');
          document.removeEventListener('click', clickHandler);
        }}
      }};
      setTimeout(() => document.addEventListener('click', clickHandler), 50);
    }}

    function filterSupplierDropdown(productId, query) {{
      const drop = document.getElementById(`sup-drop-${{productId}}`);
      if (!drop) return;

      const q = (query || '').toLowerCase().trim();
      let matches = RAW_SUPPLIERS;
      if (q) {{
        matches = RAW_SUPPLIERS.filter(s => 
          (s.razon_social && s.razon_social.toLowerCase().includes(q)) ||
          (s.ruc && s.ruc.toLowerCase().includes(q)) ||
          (s.nombre_fantasia && s.nombre_fantasia.toLowerCase().includes(q))
        );
      }}
      matches = matches.slice(0, 15);

      if (matches.length === 0) {{
        drop.innerHTML = `<div class="p-3 text-center text-slate-500 text-xs">No se encontraron proveedores para "${{q}}"</div>`;
        return;
      }}

      let itemsHtml = '';
      matches.forEach(s => {{
        const rucLabel = s.ruc ? `<span class="text-[10px] text-slate-400 font-mono">${{s.ruc}}</span>` : '';
        const fantLabel = s.nombre_fantasia && s.nombre_fantasia !== s.razon_social ? `<span class="text-[10px] text-amber-400/80 truncate block">(${{s.nombre_fantasia}})</span>` : '';
        
        itemsHtml += `
          <button 
            type="button"
            onclick="assignDirect('${{productId}}', '${{s.id}}', '${{escapeQuotes(s.razon_social)}}')"
            class="w-full text-left p-2 rounded-lg hover:bg-slate-800 transition flex items-center justify-between gap-2 border-b border-slate-800/40 last:border-0"
          >
            <div class="overflow-hidden">
              <span class="font-bold text-slate-100 text-xs block truncate">${{s.razon_social}}</span>
              ${{fantLabel}}
            </div>
            ${{rucLabel}}
          </button>
        `;
      }});
      drop.innerHTML = itemsHtml;
    }}

    function escapeQuotes(str) {{
      return (str || '').replace(/'/g, "\\'");
    }}

    async function assignDirect(productId, supplierId, supplierNombre) {{
      assignedSession[productId] = {{
        supplier_id: supplierId,
        supplier_nombre: supplierNombre,
        timestamp: new Date().toISOString()
      }};
      try {{
        localStorage.setItem('intelimarket_assigned_session', JSON.stringify(assignedSession));
      }} catch (e) {{}}

      const p = RAW_PRODUCTS.find(x => x.id === productId);
      if (p) {{
        p.assigned_supplier_id = supplierId;
        p.assigned_supplier_nombre = supplierNombre;
      }}

      showToast(`Asignado: ${{p ? p.nombre.slice(0, 25) : 'Producto'}} → ${{supplierNombre}}`, 'success');
      updateKpis();
      applyFilters();

      syncAssignmentToBackend(productId, supplierId, supplierNombre);
    }}

    async function clearAssignment(productId) {{
      delete assignedSession[productId];
      try {{
        localStorage.setItem('intelimarket_assigned_session', JSON.stringify(assignedSession));
      }} catch (e) {{}}

      const p = RAW_PRODUCTS.find(x => x.id === productId);
      if (p) {{
        delete p.assigned_supplier_id;
        delete p.assigned_supplier_nombre;
      }}

      showToast('Asignación removida', 'info');
      updateKpis();
      applyFilters();

      syncAssignmentToBackend(productId, null, null);
    }}

    async function syncAssignmentToBackend(productId, supplierId, supplierNombre) {{
      try {{
        const headers = {{ 'Content-Type': 'application/json' }};
        if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${{AUTH_TOKEN}}`;

        let url = `${{API_BASE}}/api/v1/products-tool/assign`;
        if (API_BASE.endsWith('/api')) url = `${{API_BASE}}/v1/products-tool/assign`;

        const res = await fetch(url, {{
          method: 'POST',
          headers,
          body: JSON.stringify({{ product_id: productId, supplier_id: supplierId }})
        }});

        if (!res.ok) {{
          const fallbackUrl = API_BASE.endsWith('/api') ? `${{API_BASE}}/v1/products/assign-supplier` : `${{API_BASE}}/api/v1/products/assign-supplier`;
          await fetch(fallbackUrl, {{
            method: 'POST',
            headers,
            body: JSON.stringify({{ product_id: productId, supplier_id: supplierId }})
          }});
        }}
      }} catch (err) {{
        console.warn('Error sincronizando con API:', err);
      }}
    }}

    // --- ACCIÓN MASIVA / EN LOTE ---
    let selectedBulkSupplier = null;

    function handleBulkSupplierSearch(query) {{
      const drop = document.getElementById('bulk-supplier-dropdown');
      const btn = document.getElementById('btn-bulk-apply');
      const q = (query || '').toLowerCase().trim();

      if (!q) {{
        drop.classList.add('hidden');
        return;
      }}

      const matches = RAW_SUPPLIERS.filter(s => 
        (s.razon_social && s.razon_social.toLowerCase().includes(q)) ||
        (s.ruc && s.ruc.toLowerCase().includes(q)) ||
        (s.nombre_fantasia && s.nombre_fantasia.toLowerCase().includes(q))
      ).slice(0, 10);

      if (matches.length === 0) {{
        drop.innerHTML = `<div class="p-2 text-center text-slate-500 text-xs">Sin resultados</div>`;
        drop.classList.remove('hidden');
        return;
      }}

      let html = '';
      matches.forEach(s => {{
        html += `
          <button 
            type="button" 
            onclick="selectBulkSupplier('${{s.id}}', '${{escapeQuotes(s.razon_social)}}')" 
            class="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-xs flex justify-between items-center text-slate-200"
          >
            <span class="font-bold truncate">${{s.razon_social}}</span>
            <span class="text-[10px] text-slate-400 font-mono">${{s.ruc || ''}}</span>
          </button>
        `;
      }});
      drop.innerHTML = html;
      drop.classList.remove('hidden');
    }}

    function selectBulkSupplier(id, nombre) {{
      selectedBulkSupplier = {{ id, nombre }};
      document.getElementById('bulk-supplier-search').value = nombre;
      document.getElementById('bulk-supplier-dropdown').classList.add('hidden');
      document.getElementById('btn-bulk-apply').disabled = false;
    }}

    async function applyBulkSupplier() {{
      if (!selectedBulkSupplier || selectedProductIds.size === 0) return;

      const pids = Array.from(selectedProductIds);
      const assignments = [];

      pids.forEach(pid => {{
        assignedSession[pid] = {{
          supplier_id: selectedBulkSupplier.id,
          supplier_nombre: selectedBulkSupplier.nombre,
          timestamp: new Date().toISOString()
        }};
        const p = RAW_PRODUCTS.find(x => x.id === pid);
        if (p) {{
          p.assigned_supplier_id = selectedBulkSupplier.id;
          p.assigned_supplier_nombre = selectedBulkSupplier.nombre;
        }}
        assignments.push({{ product_id: pid, supplier_id: selectedBulkSupplier.id }});
      }});

      try {{
        localStorage.setItem('intelimarket_assigned_session', JSON.stringify(assignedSession));
      }} catch (e) {{}}

      showToast(`Asignados ${{pids.length}} productos a ${{selectedBulkSupplier.nombre}}`, 'success');
      deselectAll();
      updateKpis();
      applyFilters();

      // Sincronizar en lote
      try {{
        const headers = {{ 'Content-Type': 'application/json' }};
        if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${{AUTH_TOKEN}}`;

        let url = `${{API_BASE}}/api/v1/products-tool/assign-batch`;
        if (API_BASE.endsWith('/api')) url = `${{API_BASE}}/v1/products-tool/assign-batch`;

        fetch(url, {{
          method: 'POST',
          headers,
          body: JSON.stringify({{ assignments }})
        }}).catch(() => {{}});
      }} catch (e) {{}}
    }}

    async function applySuggestionsToSelected() {{
      if (selectedProductIds.size === 0) return;
      let applied = 0;
      const assignments = [];

      selectedProductIds.forEach(pid => {{
        const p = RAW_PRODUCTS.find(x => x.id === pid);
        if (p && p.sugerencia) {{
          assignedSession[pid] = {{
            supplier_id: p.sugerencia.supplier_id,
            supplier_nombre: p.sugerencia.supplier_nombre,
            timestamp: new Date().toISOString()
          }};
          p.assigned_supplier_id = p.sugerencia.supplier_id;
          p.assigned_supplier_nombre = p.sugerencia.supplier_nombre;
          assignments.push({{ product_id: pid, supplier_id: p.sugerencia.supplier_id }});
          applied++;
        }}
      }});

      if (applied === 0) {{
        showToast('Ninguno de los seleccionados tiene sugerencia de marca', 'warn');
        return;
      }}

      try {{
        localStorage.setItem('intelimarket_assigned_session', JSON.stringify(assignedSession));
      }} catch (e) {{}}

      showToast(`Se aplicaron ${{applied}} sugerencias inteligentes`, 'success');
      deselectAll();
      updateKpis();
      applyFilters();

      try {{
        const headers = {{ 'Content-Type': 'application/json' }};
        if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${{AUTH_TOKEN}}`;
        let url = `${{API_BASE}}/api/v1/products-tool/assign-batch`;
        if (API_BASE.endsWith('/api')) url = `${{API_BASE}}/v1/products-tool/assign-batch`;
        fetch(url, {{
          method: 'POST',
          headers,
          body: JSON.stringify({{ assignments }})
        }}).catch(() => {{}});
      }} catch (e) {{}}
    }}

    // --- CONEXIÓN API & RECARGA ---
    async function checkApiConnection() {{
      const dot = document.getElementById('conn-dot');
      const label = document.getElementById('conn-label');

      try {{
        let url = `${{API_BASE}}/api/v1/products-tool/unassigned`;
        if (API_BASE.endsWith('/api')) url = `${{API_BASE}}/v1/products-tool/unassigned`;

        const res = await fetch(url);
        if (res.ok) {{
          dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
          label.textContent = 'API Conectada';
          return true;
        }}
      }} catch (e) {{}}

      dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
      label.textContent = 'Modo Local (Offline)';
      return false;
    }}

    async function reloadFromServer() {{
      const svg = document.getElementById('reload-svg');
      svg.classList.add('animate-spin');

      try {{
        let url = `${{API_BASE}}/api/v1/products-tool/unassigned`;
        if (API_BASE.endsWith('/api')) url = `${{API_BASE}}/v1/products-tool/unassigned`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Respuesta no satisfactoria del servidor');

        const fresh = await res.json();
        RAW_PRODUCTS = fresh.products || [];
        RAW_SUPPLIERS = fresh.suppliers || [];
        STATS = fresh.stats || {{}};

        // Re-mapear asignaciones de sesión
        for (const pid in assignedSession) {{
          const p = RAW_PRODUCTS.find(x => x.id === pid);
          if (p) {{
            p.assigned_supplier_id = assignedSession[pid].supplier_id;
            p.assigned_supplier_nombre = assignedSession[pid].supplier_nombre;
          }}
        }}

        populateCategoryDropdown();
        updateKpis();
        applyFilters();
        showToast('¡Catálogo y stock refrescados desde PostgreSQL!', 'success');
      }} catch (err) {{
        showToast('No se pudo conectar al API en vivo: ' + err.message, 'warn');
      }} finally {{
        setTimeout(() => svg.classList.remove('animate-spin'), 400);
      }}
    }}

    // --- MODALES & SETTINGS ---
    function openSettingsModal() {{
      document.getElementById('cfg-api-base').value = API_BASE;
      document.getElementById('cfg-token').value = AUTH_TOKEN;
      document.getElementById('settings-modal').classList.remove('hidden');
    }}

    function closeSettingsModal() {{
      document.getElementById('settings-modal').classList.add('hidden');
    }}

    function saveSettings() {{
      const newBase = document.getElementById('cfg-api-base').value.trim();
      const newToken = document.getElementById('cfg-token').value.trim();

      if (newBase) {{
        API_BASE = newBase;
        localStorage.setItem('cfg_api_base', API_BASE);
      }}
      AUTH_TOKEN = newToken;
      localStorage.setItem('access_token', AUTH_TOKEN);

      closeSettingsModal();
      checkApiConnection();
      showToast('Configuración guardada', 'success');
    }}

    async function performLogin() {{
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-pass').value.trim();

      if (!email || !password) {{
        alert('Ingresá usuario y contraseña');
        return;
      }}

      try {{
        let url = `${{API_BASE}}/api/v1/auth/login`;
        if (API_BASE.endsWith('/api')) url = `${{API_BASE}}/v1/auth/login`;

        const res = await fetch(url, {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ email, password }})
        }});

        if (!res.ok) throw new Error('Credenciales inválidas');
        const data = await res.json();
        if (data.access_token) {{
          AUTH_TOKEN = data.access_token;
          localStorage.setItem('access_token', AUTH_TOKEN);
          document.getElementById('cfg-token').value = AUTH_TOKEN;
          showToast('¡Sesión iniciada con éxito!', 'success');
          checkApiConnection();
        }}
      }} catch (err) {{
        alert('Error al iniciar sesión: ' + err.message);
      }}
    }}

    // --- EXPORTACIÓN SQL ---
    function generateSqlStatements() {{
      const statements = [];
      for (const pid in assignedSession) {{
        const asg = assignedSession[pid];
        const p = RAW_PRODUCTS.find(x => x.id === pid);
        const sku = p ? p.sku : pid;
        const nombre = p ? p.nombre.replace(/'/g, "''") : '';
        const supNombre = asg.supplier_nombre.replace(/'/g, "''");
        
        statements.push(`-- SKU: ${{sku}} - ${{nombre}} -> ${{supNombre}}\\nUPDATE products SET supplier_id = '${{asg.supplier_id}}', updated_at = NOW() WHERE id = '${{pid}}';`);
      }}
      return statements;
    }}

    function openSqlModal() {{
      const stmts = generateSqlStatements();
      const textarea = document.getElementById('sql-content');
      const countLabel = document.getElementById('sql-count-label');

      if (stmts.length === 0) {{
        textarea.value = '-- No hay asignaciones registradas en esta sesión todavía.\\n-- Asigná un proveedor a cualquier producto para generar las sentencias UPDATE.';
        countLabel.textContent = '0 sentencias';
      }} else {{
        textarea.value = `BEGIN;\\n\\n${{stmts.join('\\n\\n')}}\\n\\nCOMMIT;`;
        countLabel.textContent = `${{stmts.length}} sentencias UPDATE generadas`;
      }}

      document.getElementById('sql-modal').classList.remove('hidden');
    }}

    function closeSqlModal() {{
      document.getElementById('sql-modal').classList.add('hidden');
    }}

    function copySqlToClipboard() {{
      const textarea = document.getElementById('sql-content');
      textarea.select();
      navigator.clipboard.writeText(textarea.value);
      showToast('¡SQL copiado al portapapeles!', 'success');
    }}

    function downloadSqlFile() {{
      const stmts = generateSqlStatements();
      if (stmts.length === 0) {{
        alert('No hay asignaciones para descargar.');
        return;
      }}
      const content = `BEGIN;\\n\\n${{stmts.join('\\n\\n')}}\\n\\nCOMMIT;`;
      const blob = new Blob([content], {{ type: 'text/sql;charset=utf-8;' }});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `asignacion_proveedores_${{new Date().toISOString().slice(0, 10)}}.sql`;
      a.click();
      URL.revokeObjectURL(url);
    }}

    function exportToCsv() {{
      const rows = [
        ['SKU', 'Codigo Barra', 'Nombre Producto', 'Categoria', 'Unidad', 'Stock Real BD', 'Costo', 'Precio Venta', 'Estado', 'Proveedor Asignado', 'ID Proveedor', 'ID Producto']
      ];

      RAW_PRODUCTS.forEach(p => {{
        const asg = assignedSession[p.id];
        rows.push([
          p.sku || '',
          p.codigo_barra || '',
          `"${{(p.nombre || '').replace(/"/g, '""')}}"`,
          `"${{(p.categoria || '').replace(/"/g, '""')}}"`,
          p.unidad_medida || 'UN',
          p.stock || 0,
          p.costo || 0,
          p.precio_venta || 0,
          p.activo ? 'ACTIVO' : 'INACTIVO',
          asg ? `"${{asg.supplier_nombre.replace(/"/g, '""')}}"` : 'SIN ASIGNAR',
          asg ? asg.supplier_id : '',
          p.id
        ]);
      }});

      const csvContent = "\\uFEFF" + rows.map(e => e.join(',')).join('\\n');
      const blob = new Blob([csvContent], {{ type: 'text/csv;charset=utf-8;' }});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos_sin_proveedor_${{new Date().toISOString().slice(0, 10)}}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }}

    // --- NOTIFICACIONES TOAST ---
    function showToast(message, type = 'info') {{
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      
      let border = 'border-slate-700 bg-slate-900 text-slate-100';
      let icon = 'ℹ️';
      if (type === 'success') {{
        border = 'border-emerald-500/50 bg-slate-900 text-emerald-200';
        icon = '✅';
      }} else if (type === 'warn') {{
        border = 'border-amber-500/50 bg-slate-900 text-amber-200';
        icon = '⚠️';
      }}

      toast.className = `toast flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold ${{border}} pointer-events-auto`;
      toast.innerHTML = `<span>${{icon}}</span><span>${{message}}</span>`;
      container.appendChild(toast);

      setTimeout(() => {{
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }}, 3500);
    }}

    function renderAll() {{
      applyFilters();
    }}
  </script>

</body>
</html>
"""

    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(html)
    with open(OUTPUT_HTML_ALT, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"HTML generado exitosamente en {OUTPUT_HTML} ({len(html):,} bytes)")


if __name__ == "__main__":
    build_html()
