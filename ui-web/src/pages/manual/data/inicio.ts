import { LayoutDashboard, TrendingUp, Bot, Sparkles } from "lucide-react"
import type { ManualCategory } from "../types"

export const inicioCategory: ManualCategory = {
  id: "inicio",
  label: "Inicio",
  icon: LayoutDashboard,
  gradient: "from-blue-600 to-indigo-700",
  description: "El centro de mando del supermercado. El Dashboard ejecutivo en vivo y los tres Gerentes IA que analizan ventas, finanzas y marketing con inteligencia artificial.",
  subtitle: "Resumen ejecutivo en tiempo real + agentes de IA",
  modules: [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      tagline: "El panel de control principal del supermercado",
      category: "Inicio",
      color: "blue",
      description:
        "El Dashboard es la primera pantalla al ingresar al sistema. Reúne en una sola vista el estado de ventas, inventario, finanzas y las alertas inteligentes del negocio. Todo se actualiza en tiempo real con datos reales de la base — no hay números inventados.",
      tabs: [
        { id: "ventas", label: "Ventas en vivo" },
        { id: "inte", label: "Inteligencia" },
        { id: "ops", label: "Operación" },
      ],
      steps: [
        {
          title: "Elija el período",
          detail:
            "Arriba a la derecha de la sección de ventas encontrará el selector de período: Hoy, Últimos 7 Días, Últimos 30 Días, Este Mes o un rango personalizado. El cambio es instantáneo porque el sistema guarda una copia en memoria.",
          mockKey: "periodo",
        },
        {
          title: "Lea los KPIs de ventas",
          detail:
            "Ventas totales, cantidad de tickets, ticket promedio y deudores. Cada KPI muestra la tendencia respecto al período anterior (crecimiento o caída con flecha verde/roja).",
          mockKey: "kpis",
        },
        {
          title: "Analice las gráficas",
          detail:
            "El área de ventas por período muestra la evolución día a día (u hora a hora si eligió «Hoy»). Las barras comparan con el período anterior. Abajo, los productos más vendidos y las ventas por categoría.",
          mockKey: "charts",
        },
        {
          title: "Revise el estado operativo",
          detail:
            "La columna derecha resume: reposición sugerida por IA, cuentas por cobrar vencidas (aging), pedidos de compra recientes, y productos con stock bajo o crítico.",
          mockKey: "ops",
        },
        {
          title: "Atienda el briefing de inteligencia",
          detail:
            "El bloque «Inteligencia» muestra alertas reales: anomalías de ventas detectadas por el motor de forecast, clientes con riesgo de fuga (churn) y sugerencias de compra pendientes. Si no hay datos reales, la tarjeta no se muestra: nada falso.",
          mockKey: "ai",
        },
      ],
      mocks: {
        periodo: {
          type: "kpiGrid",
          title: "Selector de período",
          kpis: [
            { label: "Ventas del mes", value: "₲ 4.405.900.000", sub: "Septiembre 2026", color: "green", trend: "up" },
            { label: "Tickets", value: "124.800", sub: "+8.2% vs agosto", color: "blue", trend: "up" },
            { label: "Ticket promedio", value: "₲ 35.303", sub: "+3.1% vs agosto", color: "purple", trend: "up" },
            { label: "Clientes con saldo", value: "1.247", sub: "−2.4% mora", color: "amber", trend: "down" },
          ],
        },
        kpis: {
          type: "kpiGrid",
          title: "KPIs de ventas en vivo",
          kpis: [
            { label: "Ventas hoy", value: "₲ 148.350.000", sub: "al corte de las 14:30 hs", color: "green", trend: "up" },
            { label: "Tickets hoy", value: "4.210", sub: "promedio 6 min/caja", color: "blue" },
            { label: "Margen bruto", value: "24,1%", sub: "+0.8 pts vs meta", color: "purple", trend: "up" },
            { label: "Deudores a cobrar", value: "₲ 318.500.000", sub: "aging 30-60 días", color: "red", trend: "down" },
          ],
        },
        charts: {
          type: "chart",
          title: "Ventas por período (mes actual vs anterior)",
          chart: {
            kind: "bar",
            unit: "₲",
            points: [
              { label: "Lun", value: 118 },
              { label: "Mar", value: 104 },
              { label: "Mié", value: 152 },
              { label: "Jue", value: 143 },
              { label: "Vie", value: 205 },
              { label: "Sáb", value: 267 },
              { label: "Dom", value: 142 },
            ],
          },
        },
        ops: {
          type: "list",
          title: "Estado operativo",
          items: [
            { title: "Reposición sugerida por IA", sub: "18 productos para 30 días de cobertura", right: "18", badge: "IA", badgeColor: "blue" },
            { title: "Productos con stock crítico", sub: "3 SKUs bajo el punto de reposición", right: "3", badge: "URGENTE", badgeColor: "red" },
            { title: "Cuentas a cobrar vencidas", sub: "14 clientes en aging 61-90 días", right: "₲ 42.1M", badge: "ALERTA", badgeColor: "amber" },
            { title: "Órdenes de compra recientes", sub: "5 POs sin recibir", right: "5", badge: "PENDIENTE", badgeColor: "gray" },
          ],
        },
        ai: {
          type: "chat",
          title: "Briefing de inteligencia",
          chatMessages: [
            { from: "bot", text: "Detecté una anomalía: las ventas de lácteos subieron +38% el jueves — ¿promoción o quiebre de otro proveedor?" },
            { from: "bot", text: "La cartera muestra 6 clientes con riesgo alto de fuga. ¿Quiere que gestione campañas de retención?" },
            { from: "bot", text: "Se sugieren 3 órdenes de compra para Carnicería según el forecast de fin de mes." },
          ],
        },
      },
      tips: [
        "Use el buscador global con Ctrl+K para saltar a cualquier módulo sin navegar por el menú.",
        "El botón «Nuevo» en la barra superior abre el Punto de Venta para arrancar una venta al instante.",
        "Cambie el período a «Rango personalizado» para comparar quincenas o campañas específicas.",
      ],
      faq: [
        { q: "¿Los números del dashboard son reales?", a: "Sí. Todos los KPIs y gráficas se calculan desde la base de datos en el rango elegido. Si una tarjeta de IA no tiene datos suficientes, simplemente no se muestra." },
        { q: "¿Con qué frecuencia se actualiza?", a: "Al cambiar de período o al pulsar el botón de refrescar. Las operaciones del día (ventas, stock) se consultan en vivo en cada carga." },
      ],
    },
    {
      id: "sales-agent",
      label: "Gerente de Ventas IA",
      path: "/sales-agent",
      icon: TrendingUp,
      tagline: "Análisis comercial con inteligencia artificial",
      category: "Inicio",
      color: "emerald",
      description:
        "Un analista comercial que trabaja 24/7. Analiza rentabilidad por producto, aplica el principio de Pareto (80/20), propone precios, y responde preguntas sobre el negocio en lenguaje natural.",
      tabs: [
        { id: "rent", label: "Rentabilidad" },
        { id: "pareto", label: "Pareto 80/20" },
        { id: "precios", label: "Precios" },
        { id: "sim", label: "Simulador" },
      ],
      steps: [
        {
          title: "Revise la rentabilidad",
          detail:
            "El Gerente de Ventas IA calcula el margen por producto y por familia, identifica qué SKUs rinden y cuáles están por debajo del objetivo. Use el ranking para decidir renegociaciones o descontinuaciones.",
          mockKey: "rent",
        },
        {
          title: "Explore el Pareto",
          detail:
            "La gráfica 80/20 muestra qué porción del catálogo genera la mayor parte de la facturación. Los productos «clase A» son los que debe cuidar en stock y precio.",
          mockKey: "pareto",
        },
        {
          title: "Consulte la IA en chat",
          detail:
            "La pestaña de chat permite preguntar en español: «¿cuáles son los 10 productos más rentables de bebidas?» o «¿qué margen tiene el arroz tipo 1?». El agente responde con datos reales.",
          mockKey: "chat",
        },
        {
          title: "Use el simulador",
          detail:
            "Pruebe escenarios sin tocar los precios reales: suba el margen de una categoría y vea el impacto proyectado en facturación y ganancia bruta antes de aplicarlo.",
          mockKey: "sim",
        },
      ],
      mocks: {
        rent: {
          type: "table",
          title: "Top rentabilidad por producto",
          columns: [
            { label: "Producto", value: "nombre" },
            { label: "Familia", value: "familia" },
            { label: "Ventas", value: "ventas", currency: true },
            { label: "Margen", value: "margen", badge: true },
          ],
          rows: [
            { nombre: "Cerveza Pilsen 24x355ml", familia: "Bebidas", ventas: 48500000, margen: "31%", badge: "green" },
            { nombre: "Arroz Tipo 1 5kg", familia: "Almacén", ventas: 41200000, margen: "22%", badge: "green" },
            { nombre: "Coca-Cola 2.25L", familia: "Bebidas", ventas: 39800000, margen: "18%", badge: "blue" },
            { nombre: "Carne Vacio x kg", familia: "Carnicería", ventas: 36100000, margen: "29%", badge: "green" },
            { nombre: "Pan Frances (docena)", familia: "Panadería", ventas: 21400000, margen: "48%", badge: "green" },
            { nombre: "Aceite de girazol 900ml", familia: "Almacén", ventas: 18900000, margen: "12%", badge: "amber" },
          ],
        },
        pareto: {
          type: "chart",
          title: "Curva 80/20 de facturación",
          chart: {
            kind: "line",
            unit: "%",
            points: [
              { label: "10%", value: 44 },
              { label: "20%", value: 63 },
              { label: "30%", value: 76 },
              { label: "40%", value: 85 },
              { label: "50%", value: 91 },
              { label: "60%", value: 95 },
              { label: "70%", value: 98 },
              { label: "100%", value: 100 },
            ],
          },
        },
        chat: {
          type: "chat",
          title: "Chat con el Gerente de Ventas",
          chatMessages: [
            { from: "user", text: "¿Cuáles son las 5 bebidas más vendidas de este mes?" },
            { from: "bot", text: "Este mes lideran: 1) Coca-Cola 2.25L, 2) Cerveza Pilsen 24x355ml, 3) Agua mineral 1.5L, 4) Jugo Kapo 1L, 5) Gaseosa Pomelo 3L. Los tres primeros concentran el 41% de la familia Bebidas." },
            { from: "user", text: "¿Qué margen tiene el arroz tipo 1 de 5kg?" },
            { from: "bot", text: "Arroz Tipo 1 5kg (SKU 000123): precio de venta ₲ 28.500, margen actual 22%. Sobre el costo promedio de compra ₲ 23.300 y un costo logísitco estimado del 2,8%, le recomiendo mantener el precio." },
          ],
        },
        sim: {
          type: "form",
          title: "Simulador de margen",
          formFields: [
            { label: "Categoría", type: "select", value: "Almacén", options: ["Almacén", "Bebidas", "Carnicería", "Verdulería"] },
            { label: "Margen actual", type: "number", value: "18%" },
            { label: "Margen objetivo", type: "number", value: "22%" },
            { label: "Proyección de ventas", type: "number", value: "₲ 945.000.000" },
          ],
          caption: "Resultado simulado: incremento de ganancia bruta estimada: +₲ 37.800.000 / mes.",
        },
      },
      tips: [
        "Pregunte a la IA en chat libre; entiende productos, familias, márgenes y períodos (hoy, mes, semana).",
        "El simulador no modifica precios reales — es 100% predictivo.",
      ],
    },
    {
      id: "finance-agent",
      label: "Gerente Financiero IA",
      path: "/finance-agent",
      icon: Bot,
      tagline: "Torre de control financiero del negocio",
      category: "Inicio",
      color: "amber",
      description:
        "El CFO digital del supermercado. Muestra la central de liquidez, el flujo de caja proyectado, controla que no falte plata para las obligaciones y responde preguntas financieras en lenguaje natural.",
      tabs: [
        { id: "torre", label: "Torre de control" },
        { id: "flujo", label: "Flujo de caja" },
        { id: "acc", label: "Acciones" },
      ],
      steps: [
        {
          title: "Tome el pulso de la torre",
          detail:
            "La torre de control concentra dinero disponible, cuentas a cobrar, y las próximas obligaciones. El semáforo de liquidez le dice si puede cubrir el mes sin apuros.",
          mockKey: "torre",
        },
        {
          title: "Analice el flujo de caja",
          detail:
            "La proyección del flujo muestra las entradas (cobranzas, ventas) y salidas (proveedores, nómina, impuestos) por período. Identifique los momentos de pico de caja y planifique con anticipación.",
          mockKey: "flujo",
        },
        {
          title: "Consulte la IA financiera",
          detail:
            "Pregunte «¿cuántos días de caja tenemos?», «¿cuál es nuestra posición el 25 de mes?» o «¿cuánto debemos a proveedores la próxima semana?» y reciba respuestas calculadas sobre los datos reales.",
        },
        {
          title: "Ejecute acciones",
          detail:
            "Desde la pestaña de acciones puede solicitar transferencias, proponer pagos a proveedores por prioridad o marcar alertas resueltas, sin salir del módulo.",
        },
      ],
      mocks: {
        torre: {
          type: "kpiGrid",
          title: "Torre de control",
          kpis: [
            { label: "Disponible hoy", value: "₲ 441.800.000", sub: "bancos + caja + bóveda", color: "green", trend: "up" },
            { label: "A cobrar (30 días)", value: "₲ 318.500.000", sub: "aging cartera", color: "blue" },
            { label: "A pagar (30 días)", value: "₲ 285.200.000", sub: "proveedores + nómina", color: "red", trend: "down" },
            { label: "Días de caja", value: "138 días", sub: "meta: > 45 días", color: "purple" },
          ],
        },
        flujo: {
          type: "chart",
          title: "Proyección de flujo de caja (30 días)",
          chart: {
            kind: "area",
            unit: "₲ M",
            points: [
              { label: "S1", value: 240 },
              { label: "S2", value: 285 },
              { label: "S3", value: 190 },
              { label: "S4", value: 320 },
              { label: "S5", value: 235 },
            ],
          },
        },
      },
      tips: [
        "El indicador «días de caja» es el más importante: cuántos días podría operar si mañana no vende nada.",
        "Revise la torre todos los lunes para programar la semana de pagos.",
      ],
    },
    {
      id: "marketing-agent",
      label: "Gerente de Marketing IA",
      path: "/marketing-agent",
      icon: Sparkles,
      tagline: "Campañas y retención con inteligencia",
      category: "Inicio",
      color: "fuchsia",
      description:
        "El responsable de marketing digital del supermercado. Diseña campañas, identifica clientes en riesgo de fuga (anti-abandono), y coordina los envíos por WhatsApp y web. Incluye sincronización con el sistema de cupones del kiosco.",
      tabs: [
        { id: "camp", label: "Campañas IA" },
        { id: "aband", label: "Anti-abandono" },
        { id: "sync", label: "Sincronización" },
      ],
      steps: [
        {
          title: "Cree una campaña con IA",
          detail:
            "El agente propone campañas según la estacionalidad y el histórico: por ejemplo «fin de mes +9% en almacén». Configure el canal (WhatsApp o Web), el segmento y el horario de envío.",
          mockKey: "camp",
        },
        {
          title: "Atienda clientes en riesgo",
          detail:
            "La pestaña anti-abandono lista clientes que dejaron de comprar. Con un clic genere un cupón de retención o una campaña de recuperación personalizada.",
        },
        {
          title: "Sincronice los cupones del kiosco",
          detail:
            "Conecte el módulo de cupones de sorteo para enviar recordatorios automáticos y consolidar la base de clientes participando en cada campaña promocional.",
        },
      ],
      mocks: {
        camp: {
          type: "table",
          title: "Campañas activas",
          columns: [
            { label: "Campaña", value: "nombre" },
            { label: "Canal", value: "canal" },
            { label: "Envíos", value: "envios" },
            { label: "Conversión", value: "conv", badge: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { nombre: "Viernes de Carnicería", canal: "WhatsApp", envios: 12840, conv: "6.4%", estado: "Activa", badges: { conv: "green", estado: "green" } },
            { nombre: "Cupón Gran Premio", canal: "Kiosco + Web", envios: 3210, conv: "3.1%", estado: "Activa", badges: { conv: "blue", estado: "green" } },
            { nombre: "Retención inactivos 60d", canal: "WhatsApp", envios: 1820, conv: "1.9%", estado: "En pausa", badges: { conv: "amber", estado: "amber" } },
          ],
        },
      },
      tips: [
        "Combine campañas de WhatsApp con los cupones del kiosco para duplicar el alcance.",
        "El anti-abandono prioriza automáticamente a los clientes de mayor ticket histórico.",
      ],
    },
  ],
}