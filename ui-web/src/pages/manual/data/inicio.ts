import { LayoutDashboard, TrendingUp, Bot, Sparkles } from "lucide-react"
import type { ManualCategory } from "../types"

export const inicioCategory: ManualCategory = {
  id: "inicio",
  label: "Inicio & Dirección",
  icon: LayoutDashboard,
  gradient: "from-blue-600 to-indigo-700",
  description:
    "La torre de control ejecutiva del supermercado: monitoreo de facturación en vivo, curvas horarias de venta para dimensionar cajas, semáforo de liquidez, y los agentes de IA de ventas, finanzas y marketing.",
  subtitle: "Control ejecutivo en vivo, toma de decisiones y agentes inteligentes",
  modules: [
    {
      id: "dashboard",
      label: "Dashboard Ejecutivo",
      path: "/dashboard",
      icon: LayoutDashboard,
      tagline: "El panel de control general de ventas, márgenes y operaciones",
      category: "Inicio & Dirección",
      color: "blue",
      role: "Directorio, Gerente General, Jefes de Operaciones y Encargados de Turno",
      prerequisites: [
        "Usuario con rol de Gerencia, Administración o Supervisión.",
        "Conexión a la red local o Tailscale para actualización de datos en tiempo real.",
      ],
      workflowOverview:
        "El Dashboard es la pantalla de inicio del sistema. Procesa en tiempo real todas las ventas cobradas en las líneas de caja, los movimientos de mercadería y los saldos financieros. Permite a la gerencia saber en cualquier momento cuánto se lleva vendido en el día, cuántos clientes pasaron por caja, cuál es el ticket promedio y qué sectores están requiriendo reposición o cobranza urgente.",
      description:
        "Panel de control centralizado con métricas no inventadas (directas de PostgreSQL): ventas acumuladas hoy y en el mes, comparación contra el período anterior, desglose por forma de pago (efectivo ₲ y R$, tarjetas, crédito), gráfico de ventas hora por hora para detectar cuellos de botella en cajas, y alertas de compras pendientes.",
      tabs: [
        { id: "ventas", label: "Ventas en Vivo" },
        { id: "kpis", label: "KPIs Financieros" },
        { id: "horas", label: "Curva Horaria de Cajas" },
        { id: "alertas", label: "Alertas Operativas" },
      ],
      steps: [
        {
          title: "1. Selección del Período de Análisis",
          detail:
            "En la esquina superior derecha, use el selector rápido: 'Hoy' (para el pulso del día en curso), 'Últimos 7 Días' (para ver la semana comercial), 'Este Mes' o 'Rango Personalizado' (para comparar quincenas fiscales o semanas de pago de sueldos).",
          mockKey: "periodo",
        },
        {
          title: "2. Lectura e Interpretación de los KPIs Principales",
          detail:
            "Audite los 4 números clave: Ventas Totales (en ₲), Cantidad de Tickets Emitidos, Ticket Promedio por Cliente (indica si los clientes están llevando carritos llenos o compras menores) y Margen Bruto Estimado. Cada KPI muestra una flecha verde o roja indicando la variación porcentual contra el mismo período anterior.",
          mockKey: "kpis",
        },
        {
          title: "3. Análisis de la Curva Horaria para Dotación de Cajeras",
          detail:
            "El gráfico de barras hora a hora muestra el flujo de clientes. En Extra Supermercado los picos habituales se dan entre las 11:30 y 13:30 hs y entre las 18:00 y 20:30 hs. Si la curva muestra saturación en esas horas, el encargado de salón debe habilitar cajas de apoyo (Caja 03 o Caja 04) para que la fila no supere los 3 carritos.",
          mockKey: "charts",
        },
        {
          title: "4. Monitoreo de Alertas Operativas y de Reposición",
          detail:
            "La columna lateral resume eventos críticos: productos con quiebre de stock en salón, facturas de proveedores que vencen en los próximos 3 días, clientes con líneas de crédito vencidas y pedidos de reposición generados automáticamente.",
          mockKey: "ops",
        },
      ],
      mocks: {
        periodo: {
          type: "kpiGrid",
          title: "Resumen de Facturación — Mes en Curso (Septiembre 2026)",
          kpis: [
            { label: "Ventas Netas del Mes", value: "₲ 4.405.900.000", sub: "Meta presupuestada: 92%", color: "green", trend: "up" },
            { label: "Tickets Emitidos", value: "124.800", sub: "+8.2% vs agosto", color: "blue", trend: "up" },
            { label: "Ticket Promedio", value: "₲ 35.303", sub: "Promedio: 4.8 artículos", color: "purple", trend: "up" },
            { label: "Cobranza de Créditos", value: "₲ 418.500.000", sub: "Mora reducida en 2.4%", color: "amber", trend: "down" },
          ],
        },
        kpis: {
          type: "kpiGrid",
          title: "Estado del Día en Vivo — Corte 15:30 hs",
          kpis: [
            { label: "Facturación de Hoy", value: "₲ 148.350.000", sub: "11 cajas activas", color: "green", trend: "up" },
            { label: "Clientes Atendidos", value: "4.210 tickets", sub: "Tiempo promedio: 3.2 min", color: "blue" },
            { label: "Efectivo Recaudado (₲)", value: "₲ 98.400.000", sub: "R$ 34.200 en gavetas", color: "amber" },
            { label: "Tarjetas & QR", value: "₲ 49.950.000", sub: "Bancard / Dinelco", color: "purple" },
          ],
        },
        charts: {
          type: "chart",
          title: "Ventas por Día de la Semana (Comparativa Semanal)",
          chart: {
            kind: "bar",
            unit: "₲ M",
            points: [
              { label: "Lun", value: 118 },
              { label: "Mar", value: 104 },
              { label: "Mié", value: 152 },
              { label: "Jue", value: 143 },
              { label: "Vie (Promo)", value: 205 },
              { label: "Sáb (Pico)", value: 267 },
              { label: "Dom", value: 142 },
            ],
          },
        },
        ops: {
          type: "list",
          title: "Alertas Operativas Críticas de Salón",
          items: [
            { title: "Quiebre de Góndola: Harina Común 1kg", sub: "Stock en cero en Salón. Hay 40 fardos en Depósito Central.", right: "URGENTE", badge: "REPOSICIÓN", badgeColor: "red" },
            { title: "Caja 02: gaveta supera límite de seguridad", sub: "Efectivo acumulado: ₲ 12.400.000. Solicitar sangría de retiro a Bóveda.", right: "SEGURIDAD", badge: "BOVEDA", badgeColor: "amber" },
            { title: "Factura Casa Gonzalito S.R.L. por vencer", sub: "Vencimiento crédito: 10/09/2026 por ₲ 48.900.000.", right: "FINANZAS", badge: "PAGOS", badgeColor: "blue" },
          ],
        },
      },
      useCases: [
        {
          title: "Caso 1: Detección temprana de cuello de botella en línea de cajas un sábado a mediodía",
          scenario:
            "A las 12:15 hs el encargado de salón nota que el tiempo promedio por ticket subió de 3 a 7 minutos y los clientes esperan en fila con carritos llenos.",
          stepByStep: [
            "1. En el Dashboard, observe el KPI 'Tickets por Hora' del día de hoy.",
            "2. Note que el volumen de tickets superó los 80 tickets/hora por caja activa.",
            "3. En la sección Operaciones, verifique qué cajas están abiertas (Caja 01, 02 y 05).",
            "4. Asigne de inmediato un cajero de relevo para abrir la Caja 03 y Caja 04 de apoyo.",
            "5. En 10 minutos la fila se descongestiona y el ticket promedio se mantiene alto sin pérdidas de ventas por clientes que desisten de la compra.",
          ],
          keyLesson:
            "Monitorear las cajas en tiempo real evita la fuga de clientes por demoras en fila, especialmente en horas pico de fin de semana.",
        },
        {
          title: "Caso 2: Detección de caída anormal de facturación por fallo de terminal POS",
          scenario:
            "Entre las 14:00 y las 15:00 hs el gráfico horario muestra una caída del 50% en ventas respecto al día anterior sin causa climática aparente.",
          stepByStep: [
            "1. El gerente nota el bajón en la curva de facturación del Dashboard.",
            "2. Desglosa las ventas por medio de pago y detecta que las ventas con Tarjeta/QR cayeron a cero.",
            "3. Acude a la línea de cajas y descubre que el switch de red de los terminales Bancard/Dinelco se desenchufó.",
            "4. Se reconecta el cable de red y los terminales vuelven a procesar pagos electrónicos de inmediato.",
          ],
          keyLesson:
            "Las caídas bruscas en el gráfico horario suelen alertar problemas técnicos antes de que los propios clientes o cajeros lo reporten.",
        },
      ],
      commonErrors: [
        {
          error: "Duda: '¿Por qué el Dashboard no muestra las ventas si las cajas están cobrando?'",
          cause: "El selector de período quedó configurado en una fecha anterior o la caja está trabajando en modo offline momentáneo.",
          solution:
            "Verifique que el selector esté en 'Hoy' y pulse el botón de refrescar. Si la caja perdió red momentáneamente, sus tickets se sincronizan en bloque en cuanto recupera enlace con el servidor.",
        },
      ],
      shortcutsOrHotkeys: [
        { key: "F5", action: "Actualizar métricas en tiempo real" },
        { key: "Alt + 1", action: "Ver período 'Hoy'" },
        { key: "Alt + 2", action: "Ver período 'Este Mes'" },
      ],
      tips: [
        "Proyecte el Dashboard en una pantalla en la oficina de supervisión para tener control visual constante de la tienda.",
        "Compare siempre el sábado contra el sábado anterior para evaluar el impacto real de las promociones del fin de semana.",
      ],
      faq: [
        {
          q: "¿Los datos del Dashboard incluyen las ventas a crédito?",
          a: "Sí. Las ventas a crédito se computan en la facturación total y se desglosan en el KPI de 'Cuentas a Cobrar / Crédito' para no confundirlas con la recaudación en efectivo líquido.",
        },
      ],
    },
    {
      id: "sales-agent",
      label: "Gerente de Ventas IA",
      path: "/sales-agent",
      icon: TrendingUp,
      tagline: "Análisis comercial, curva de Pareto 80/20 y elasticidad de precios",
      category: "Inicio & Dirección",
      color: "emerald",
      role: "Gerencia Comercial, Jefes de Compras y Analistas de Precios",
      description:
        "Analista comercial inteligente que audita la rentabilidad real de cada artículo del catálogo. Aplica el análisis de Pareto (80/20) para identificar qué 20% de los productos genera el 80% de las ganancias, simula escenarios de cambio de margen sin alterar precios reales y responde preguntas en lenguaje natural sobre rotación y ventas.",
      tabs: [
        { id: "rent", label: "Rentabilidad por Producto" },
        { id: "pareto", label: "Curva Pareto 80/20" },
        { id: "sim", label: "Simulador de Márgenes" },
        { id: "chat", label: "Chat Comercial con IA" },
      ],
      steps: [
        {
          title: "1. Auditoría del Ranking de Rentabilidad",
          detail:
            "Revise la tabla de márgenes brutos por familia comercial. Identifique qué productos aportan margen alto (ej. Panadería 48%, Carnicería 29%) y cuáles operan como 'gancho' con margen bajo (ej. Azúcar 8%, Aceite 12%).",
          mockKey: "rent",
        },
        {
          title: "2. Gestión de la Curva de Pareto 80/20",
          detail:
            "En la solapa Pareto, visualice los productos 'Clase A' (artículos estrella que jamás deben sufrir quiebre de stock, como Coca-Cola, Cerveza Brahma, Leche y Arroz). La IA los clasifica automáticamente para priorizar sus órdenes de compra.",
          mockKey: "pareto",
        },
        {
          title: "3. Simulación de Escenarios de Margen",
          detail:
            "Use el simulador para proyectar: '¿Cuánto más ganaría el supermercado si subimos el margen de Limpieza del 18% al 21%?'. El simulador estima la ganancia bruta adicional sin tocar los precios en góndola.",
          mockKey: "sim",
        },
      ],
      mocks: {
        rent: {
          type: "table",
          title: "Top Rentabilidad por Producto — Septiembre 2026",
          columns: [
            { label: "Producto", value: "nombre" },
            { label: "Familia", value: "familia" },
            { label: "Facturación (₲)", value: "ventas", currency: true },
            { label: "Margen Bruto", value: "margen", badge: true },
          ],
          rows: [
            { nombre: "CERVEZA BRAHMITA 269ML (PACK X12)", familia: "Bebidas", ventas: 48500000, margen: "31%", badge: "green" },
            { nombre: "ARROZ TIPO 1 5KG", familia: "Almacén", ventas: 41200000, margen: "22%", badge: "green" },
            { nombre: "COCA COLA 2.25L", familia: "Bebidas", ventas: 39800000, margen: "18%", badge: "blue" },
            { nombre: "COSTILLA DE PRIMERA X KG", familia: "Carnicería", ventas: 36100000, margen: "29%", badge: "green" },
            { nombre: "PAN FRANCÉS X DOCENA", familia: "Panadería", ventas: 21400000, margen: "48%", badge: "green" },
          ],
        },
        pareto: {
          type: "chart",
          title: "Concentración de Facturación — Curva 80/20",
          chart: {
            kind: "line",
            unit: "%",
            points: [
              { label: "10% SKUs", value: 44 },
              { label: "20% SKUs (Clase A)", value: 68 },
              { label: "40% SKUs", value: 85 },
              { label: "70% SKUs", value: 96 },
              { label: "100% SKUs", value: 100 },
            ],
          },
        },
        sim: {
          type: "form",
          title: "Simulador de Incremento de Margen Comercial",
          formFields: [
            { label: "Familia a Simular", type: "select", value: "Limpieza & Hogar", options: ["Almacén", "Bebidas", "Carnicería", "Limpieza & Hogar", "Lácteos"] },
            { label: "Margen Bruto Actual", type: "number", value: "18.5%" },
            { label: "Margen Objetivo Propuesto", type: "number", value: "22.0%" },
            { label: "Volumen Estimado de Venta Mensual", type: "number", value: "₲ 420.000.000" },
          ],
          caption: "Impacto estimado: +₲ 14.700.000 de utilidad bruta mensual sin riesgo de pérdida de volumen.",
        },
      },
      tips: [
        "Los productos 'Clase A' de Pareto deben auditarse físicamente todos los días en góndola para evitar quiebres ocultos.",
      ],
    },
    {
      id: "finance-agent",
      label: "Gerente Financiero IA",
      path: "/finance-agent",
      icon: Bot,
      tagline: "Liquidez, cobertura de compromisos y flujo de caja proyectado",
      category: "Inicio & Dirección",
      color: "amber",
      role: "Gerente Financiero, Tesorero Central y Contadores",
      description:
        "CFO digital que vigila la salud financiera del supermercado: consolida la liquidez de cuentas bancarias, bóveda y cajas, proyecta el flujo de caja a 30 días para anticipar el pago de sueldos y proveedores, y advierte si los días de caja disponible caen bajo el umbral de seguridad.",
      tabs: [
        { id: "torre", label: "Torre de Control de Liquidez" },
        { id: "flujo", label: "Flujo de Fondos Proyectado" },
      ],
      steps: [
        {
          title: "1. Auditoría del Semáforo de Liquidez y Días de Caja",
          detail:
            "Verifique el indicador 'Días de Caja': representa cuántos días podría operar el supermercado pagando todos sus gastos fijos si mañana no ingresara un solo guaraní. En Extra Supermercado el objetivo es mantenerse por encima de 45 días.",
          mockKey: "torre",
        },
        {
          title: "2. Proyección de Obligaciones a Pagar vs Cobranzas",
          detail:
            "El flujo proyectado grafica las obligaciones con proveedores de la semana (ej. facturas de Casa Gonzalito, lácteos, carnes) contrastadas con las cobranzas esperadas de créditos y ventas contado.",
          mockKey: "flujo",
        },
      ],
      mocks: {
        torre: {
          type: "kpiGrid",
          title: "Posición Consolidada de Liquidez",
          kpis: [
            { label: "Dinero Disponible", value: "₲ 441.800.000", sub: "Bancos + Bóveda + Cajas", color: "green", trend: "up" },
            { label: "Cuentas por Cobrar (30d)", value: "₲ 318.500.000", sub: "Créditos comerciales", color: "blue" },
            { label: "Cuentas por Pagar (30d)", value: "₲ 285.200.000", sub: "Proveedores + Nómina", color: "red", trend: "down" },
            { label: "Días de Caja", value: "138 días", sub: "Meta: > 45 días (SALUDABLE)", color: "purple" },
          ],
        },
        flujo: {
          type: "chart",
          title: "Flujo Neto Proyectado a 4 Semanas (₲ Millones)",
          chart: {
            kind: "area",
            unit: "₲ M",
            points: [
              { label: "Semana 1", value: 240 },
              { label: "Semana 2 (Pago Prov)", value: 180 },
              { label: "Semana 3 (Cobranzas)", value: 290 },
              { label: "Semana 4 (Sueldos)", value: 215 },
            ],
          },
        },
      },
      tips: [
        "Revise la torre de liquidez los lunes por la mañana antes de autorizar las transferencias a proveedores de la semana.",
      ],
    },
    {
      id: "marketing-agent",
      label: "Gerente de Marketing IA",
      path: "/marketing-agent",
      icon: Sparkles,
      tagline: "Campañas automáticas, retención de clientes y promociones",
      category: "Inicio & Dirección",
      color: "fuchsia",
      role: "Encargados de Marketing, Fidelización y Atención al Cliente",
      description:
        "Diseña y gestiona promociones de fin de semana, detecta clientes habituales que hace más de 30 días no visitan el supermercado (anti-abandono) y coordina avisos automáticos por WhatsApp y la integración con cupones de sorteo del ExtraClub.",
      steps: [
        {
          title: "1. Creación de Campañas Promocionales con IA",
          detail:
            "El asistente analiza qué artículos tienen exceso de stock en depósito y propone promociones atractivas (ej. 'Viernes de Carnicería' o 'Super Sábado de Bebidas').",
        },
        {
          title: "2. Campañas Anti-Abandono de Clientes",
          detail:
            "El sistema lista clientes que disminuyeron su frecuencia de compra y permite enviarles un cupón de descuento por WhatsApp para incentivarlos a volver a la tienda.",
        },
      ],
      mocks: {
        camp: {
          type: "table",
          title: "Campañas Promocionales en Marcha",
          columns: [
            { label: "Nombre de la Campaña", value: "nombre" },
            { label: "Canal", value: "canal" },
            { label: "Impactos", value: "envios" },
            { label: "Tasa de Retorno", value: "conv", badge: true },
          ],
          rows: [
            { nombre: "Viernes de Carnicería & Asado", canal: "WhatsApp + Redes", envios: "12.840", conv: "6.4% retorno", badge: "green" },
            { nombre: "Sorteo Cupones ExtraClub", canal: "Kiosco + Web", envios: "3.210", conv: "14.2% canje", badge: "blue" },
            { nombre: "Recuperación Inactivos (45 días)", canal: "WhatsApp Directo", envios: "1.820", conv: "3.8% retorno", badge: "amber" },
          ],
        },
      },
      tips: [
        "Active las campañas de WhatsApp los días jueves por la tarde para capturar las compras de abastecimiento del fin de semana.",
      ],
    },
  ],
}