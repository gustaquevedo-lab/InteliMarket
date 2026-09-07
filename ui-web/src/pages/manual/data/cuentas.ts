import { DollarSign, ReceiptText, Building } from "lucide-react"
import type { ManualCategory } from "../types"

export const cuentasCategory: ManualCategory = {
  id: "cuentas",
  label: "Finanzas & Tesorería",
  icon: DollarSign,
  gradient: "from-amber-600 to-orange-700",
  description: "Las cuentas corrientes del negocio: a cobrar, a pagar, gastos operativos, el PyG diario por departamento y la gestión financiera.",
  subtitle: "Cobranzas, pagos y rentabilidad",
  modules: [
    {
      id: "cuentas-cobrar",
      label: "Cuentas por Cobrar",
      path: "/accounts-receivable",
      icon: DollarSign,
      tagline: "Documentos, aging y scoring de la cartera",
      category: "Finanzas & Tesorería",
      color: "emerald",
      description:
        "Todas las cuentas a cobrar de los clientes: documentos (facturas con saldo), el análisis de vejeces (aging: corriente, 30, 60, 90+ días), scoring de clientes morosos y la gestión de recibos de cobranza.",
      tabs: [
        { id: "documentos", label: "Documentos" },
        { id: "aging", label: "Aging" },
        { id: "scoring", label: "Scoring" },
        { id: "recibos", label: "Recibos" },
      ],
      steps: [
        {
          title: "Vea los documentos a cobrar",
          detail: "Cada factura con saldo pendiente: cliente, monto, vencimiento y días de atraso. Filtre por estado (corriente, vencida, parcial).",
          mockKey: "docs",
        },
        {
          title: "Analice el aging",
          detail: "La distribución de la deuda por rango de días revela el riesgo: cartera concentrada en 90+ necesita acciones de cobranza inmediata.",
          mockKey: "aging",
        },
        {
          title: "Genere recibos de cobranza",
          detail: "Al recibir un pago, genere el recibo que imputa al documento y deja el saldo actualizado.",
        },
      ],
      mocks: {
        docs: {
          type: "table",
          title: "Documentos a cobrar",
          columns: [
            { label: "Nº", value: "numero" },
            { label: "Cliente", value: "cliente" },
            { label: "Vence", value: "vence" },
            { label: "Saldo", value: "saldo", currency: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { numero: "001-012-00014501", cliente: "Super Don Pedro", vence: "05/09", saldo: 45200000, estado: "Vencida", badge: "red" },
            { numero: "001-012-00014577", cliente: "Despensa El Centro", vence: "12/09", saldo: 12850000, estado: "Corriente", badge: "green" },
            { numero: "001-012-00014612", cliente: "Carnes S.A.", vence: "20/09", saldo: 9810000, estado: "Corriente", badge: "green" },
            { numero: "001-012-00014680", cliente: "Minimarket ABC", vence: "08/09", saldo: 6500000, estado: "Vencida", badge: "amber" },
          ],
        },
        aging: {
          type: "chart",
          title: "Aging de la cartera",
          chart: {
            kind: "bar",
            unit: "₲ M",
            points: [
              { label: "Corriente", value: 142 },
              { label: "30 días", value: 78 },
              { label: "60 días", value: 46 },
              { label: "90 días", value: 32 },
              { label: "90+ días", value: 21 },
            ],
          },
        },
      },
      tips: [
        "Configure umbrales de vencimiento para que el POS avise antes de vender a crédito a un cliente moroso.",
        "Exporte el aging a Excel para el análisis semanal de la cartera.",
      ],
      faq: [
        { q: "¿Cómo se relaciona con el módulo de Scoring de Crédito?", a: "Los vencimientos alimentan el scoring del cliente: a mayor atraso, menor score y mayor riesgo de bloqueo." },
      ],
    },
    {
      id: "cuentas-pagar",
      label: "Cuentas por Pagar (AP)",
      path: "/payments",
      icon: ReceiptText,
      tagline: "Facturas de proveedores y lotes de pago",
      category: "Finanzas & Tesorería",
      color: "blue",
      description:
        "Las cuentas a pagar: facturas de proveedores conciliadas, el aging de pagos, los lotes de pago (seleccione varias facturas y páguelas juntas) y el historial de pagos realizados con retención.",
      tabs: [
        { id: "facturas", label: "Facturas" },
        { id: "aging", label: "Aging" },
        { id: "lotes", label: "Lotes de pago" },
        { id: "historial", label: "Historial" },
      ],
      steps: [
        {
          title: "Revise las facturas a pagar",
          detail: "Las facturas de proveedores conciliadas (matching OK) quedan habilitadas para pago con su vencimiento y retención.",
          mockKey: "facturas",
        },
        {
          title: "Arme el lote de pago",
          detail: "Seleccione varias facturas del mismo proveedor o período y págelas en un solo lote. El sistema calcula retenciones (ej: 30% según config) e imputa el banco o caja.",
          mockKey: "lotes",
        },
        {
          title: "Siga el historial",
          detail: "El historial muestra cada pago: proveedor, facturas canceladas, monto, medio y fecha.",
        },
      ],
      mocks: {
        facturas: {
          type: "table",
          title: "Facturas por vencer",
          columns: [
            { label: "Nº", value: "numero" },
            { label: "Proveedor", value: "proveedor" },
            { label: "Vence", value: "vence" },
            { label: "Total", value: "total", currency: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { numero: "001-004-0001122", proveedor: "Frigorífico Concepción", vence: "10/09", total: 22350000, estado: "A pagar", badge: "amber" },
            { numero: "001-002-0008891", proveedor: "La Lactea", vence: "12/09", total: 15840000, estado: "A pagar", badge: "amber" },
            { numero: "003-001-0003321", proveedor: "Abasto Central", vence: "15/09", total: 9870000, estado: "Conciliada", badge: "blue" },
            { numero: "001-001-0002210", proveedor: "Cervepar", vence: "05/09", total: 84200000, estado: "Vencida", badge: "red" },
          ],
        },
        lotes: {
          type: "form",
          title: "Nuevo lote de pago",
          formFields: [
            { label: "Proveedor", type: "select", value: "Frigorífico Concepción", options: ["Frigorífico Concepción", "La Lactea", "Cervepar"] },
            { label: "Facturas seleccionadas", type: "text", value: "002-1 (2 facturas)", placeholder: "" },
            { label: "Medio de pago", type: "select", value: "Transferencia", options: ["Transferencia", "Cheque", "Efectivo"] },
            { label: "Retención IRP (30%)", type: "number", value: "30%" },
          ],
        },
      },
      faq: [
        { q: "¿Qué es la retención?", a: "Es el porcentaje que se retiene del pago al proveedor (ej. IRP 30% para servicios o compras mayores). El sistema la calcula y la declara en los libros de retenciones." },
      ],
    },
    {
      id: "gastos",
      label: "Gastos Operativos",
      path: "/gastos",
      icon: ReceiptText,
      tagline: "Gastos, fondos rotativos y caja chica",
      category: "Finanzas & Tesorería",
      color: "orange",
      description:
        "Registre todos los gastos operativos del día: pagos de servicios, compras menores, caja chica y fondos rotativos por sector. Con categorías, centros de costo y la recomendación financiera.",
      steps: [
        {
          title: "Registre el gasto",
          detail: "Cargue el gasto con su categoría (limpieza, energía, mantenimiento), centro de costo y comprobante. Se imputa al fondo correspondiente.",
          mockKey: "gasto",
        },
        {
          title: "Maneje fondos y caja chica",
          detail: "Cada sector puede tener su fondo rotativo. Al hacer un gasto, el fondo se descuenta; al rendir, se repone.",
          mockKey: "fondos",
        },
        {
          title: "Vea las recomendaciones",
          detail: "El módulo analiza los gastos y sugiere: dónde hay sobrecoso, qué proveedor de servicios conviene renegociar, y qué gastos se pueden automatizar.",
        },
      ],
      mocks: {
        gasto: {
          type: "form",
          title: "Nuevo gasto",
          formFields: [
            { label: "Descripción", type: "text", value: "Reparación de freezer", required: true },
            { label: "Categoría", type: "select", value: "Mantenimiento", options: ["Mantenimiento", "Limpieza", "Energía", "Servicios", "Transporte", "Otros"] },
            { label: "Centro de costo", type: "select", value: "Depósito", options: ["Salón", "Depósito", "Carnicería", "Administración"] },
            { label: "Monto", type: "number", value: "₲ 850.000", required: true },
          ],
        },
        fondos: {
          type: "list",
          title: "Fondos rotativos",
          items: [
            { title: "Caja chica administración", sub: "₲ 2.000.000 · disponible ₲ 1.450.000", badge: "Activo", badgeColor: "green" },
            { title: "Fondo depósito", sub: "₲ 1.500.000 · disponible ₲ 250.000", badge: "Reponer", badgeColor: "amber" },
            { title: "Fondo carnicería", sub: "₲ 1.000.000 · disponible ₲ 1.000.000", badge: "Activo", badgeColor: "green" },
          ],
        },
      },
      tips: [
        "Impute cada gasto a su centro de costo: el PyG diario por departamento se alimenta con estos datos.",
      ],
    },
    {
      id: "pyg-diario",
      label: "PyG Diario por Depto.",
      path: "/pyg-diario",
      icon: DollarSign,
      tagline: "Resultado diario por departamento",
      category: "Finanzas & Tesorería",
      color: "fuchsia",
      description:
        "El estado de resultado día a día y por departamento: ventas, costos, márgenes y gastos directos de cada sector (carnicería, verdulería, panadería, almacén). Sepa qué sector gana y qué sector pierde.",
      tabs: [
        { id: "dashboard", label: "Dashboard" },
        { id: "departamentos", label: "Por depto." },
        { id: "margen", label: "Análisis de margen" },
        { id: "gastos", label: "Gastos directos" },
      ],
      steps: [
        {
          title: "Vea el resultado del día",
          detail: "El dashboard muestra ventas, costo de mercadería vendida y margen bruto del día, comparados contra el día anterior y el presupuesto.",
          mockKey: "resultado",
        },
        {
          title: "Compare departamentos",
          detail: "Cada departamento tiene su fila: ventas, margen y gastos directos (nómina del sector, energía, mermas). El % de margen revela cuáles rinden.",
          mockKey: "deptos",
        },
        {
          title: "Exporte el PyG",
          detail: "Descargue el PyG diario o mensual en PDF para compartir con gerencia.",
        },
      ],
      mocks: {
        resultado: {
          type: "kpiGrid",
          title: "Resultado de hoy",
          kpis: [
            { label: "Ventas del día", value: "₲ 148.350.000", sub: "+6% vs lunes previo", color: "green", trend: "up" },
            { label: "CMV", value: "₲ 112.540.000", sub: "76% de las ventas", color: "blue" },
            { label: "Margen bruto", value: "₲ 35.810.000", sub: "24,1%", color: "purple", trend: "up" },
            { label: "Gastos directos", value: "₲ 12.400.000", sub: "8,4% de las ventas", color: "amber" },
          ],
        },
        deptos: {
          type: "table",
          title: "Margen por departamento — semana",
          columns: [
            { label: "Departamento", value: "depto" },
            { label: "Ventas", value: "ventas", currency: true },
            { label: "Margen %", value: "margen", badge: true },
            { label: "Gastos", value: "gastos", currency: true },
            { label: "Resultado", value: "resultado", currency: true },
          ],
          rows: [
            { depto: "Panadería", ventas: 38600000, margen: "51%", badge: "green", gastos: 7400000, resultado: 12400000 },
            { depto: "Carnicería", ventas: 87200000, margen: "29%", badge: "green", gastos: 15800000, resultado: 9500000 },
            { depto: "Verdulería", ventas: 41500000, margen: "21%", badge: "amber", gastos: 9100000, resultado: -260000 },
            { depto: "Almacén", ventas: 128400000, margen: "18%", badge: "blue", gastos: 12400000, resultado: 10700000 },
          ],
        },
      },
      tips: [
        "El margen de un departamento sin sus gastos directos engaña: el PyG diario descuenta ambos.",
      ],
    },
    {
      id: "financiero",
      label: "Gestión Financiera",
      path: "/financiero",
      icon: Building,
      tagline: "Tesorería, presupuestos y flujo de caja",
      category: "Finanzas & Tesorería",
      color: "slate",
      description:
        "La vista financiera consolidada: dashboard financiero, cuentas por pagar con lotes, proyección de flujo de caja y presupuestos por rubro (carnes, lácteos, panificados, limpieza…).",
      tabs: [
        { id: "dashboard", label: "Dashboard" },
        { id: "ap", label: "Cuentas por pagar" },
        { id: "cashflow", label: "Flujo de caja" },
        { id: "presup", label: "Presupuestos" },
      ],
      steps: [
        {
          title: "Vea el dashboard financiero",
          detail: "Indicadores clave: disponible, a cobrar, a pagar, y el resultado del período con su estructura de margen.",
          mockKey: "dash",
        },
        {
          title: "Proyecte el flujo de caja",
          detail: "La proyección combina cobranzas esperadas y pagos comprometidos. La línea de referencia marca el mínimo deseado de caja (colchón).",
          mockKey: "flujo",
        },
        {
          title: "Gestione presupuestos",
          detail: "Defina presupuestos mensuales por rubro de gasto. El sistema compara contra lo ejecutado y avisa cuando se supera.",
          mockKey: "presup",
        },
      ],
      mocks: {
        dash: {
          type: "kpiGrid",
          title: "Dashboard financiero",
          kpis: [
            { label: "Ventas del período", value: "₲ 4.405.900.000", sub: "mes actual", color: "green" },
            { label: "Costo de mercadería", value: "₲ 3.348.484.000", sub: "76% de las ventas", color: "blue" },
            { label: "Gastos operativos", value: "₲ 531.860.000", sub: "12,1% de las ventas", color: "amber" },
            { label: "EBITDA", value: "₲ 525.556.000", sub: "11,9% de las ventas", color: "purple", trend: "up" },
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
        presup: {
          type: "table",
          title: "Presupuesto vs ejecutado — septiembre",
          columns: [
            { label: "Rubro", value: "rubro" },
            { label: "Presupuesto", value: "presupuesto", currency: true },
            { label: "Ejecutado", value: "ejecutado", currency: true },
            { label: "Uso", value: "uso", badge: true },
          ],
          rows: [
            { rubro: "Nómina", presupuesto: 285000000, ejecutado: 210000000, uso: "74%", badge: "green" },
            { rubro: "Energía ANDE", presupuesto: 68500000, ejecutado: 41200000, uso: "60%", badge: "green" },
            { rubro: "Publicidad", presupuesto: 25000000, ejecutado: 23800000, uso: "95%", badge: "amber" },
            { rubro: "Otros", presupuesto: 30000000, ejecutado: 21400000, uso: "71%", badge: "green" },
          ],
        },
      },
      tips: [
        "El colchón de caja se fija en configuración: la proyección alerta si el mínimo proyectado cae por debajo.",
      ],
    },
  ],
}