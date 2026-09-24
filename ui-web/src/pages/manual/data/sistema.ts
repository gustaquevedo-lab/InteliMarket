import { LineChart, PieChart, Fingerprint, Settings, Building, Users, ShieldCheck } from "lucide-react"
import type { ManualCategory } from "../types"

export const sistemaCategory: ManualCategory = {
  id: "sistema",
  label: "Inteligencia & Sistema",
  icon: LineChart,
  gradient: "from-slate-700 to-gray-800",
  description: "La inteligencia y el gobierno del sistema: business intelligence, reportes gerenciales, auditoría y riesgos, configuración, sucursales, usuarios y permisos.",
  subtitle: "Analítica, control y configuración",
  modules: [
    {
      id: "reports",
      label: "Business Intelligence",
      path: "/reports",
      icon: LineChart,
      tagline: "Ventas, familias, IVA e inventario a fondo",
      category: "Inteligencia & Sistema",
      color: "indigo",
      description:
        "El tablero analítico profundo: resumen de ventas, ventas por familia de producto, la composición fiscal/IVA y el análisis de rotación de inventario. Todo con datos reales en el período elegido.",
      tabs: [
        { id: "resumen", label: "Resumen" },
        { id: "familia", label: "Ventas por familia" },
        { id: "fiscal", label: "Fiscal / IVA" },
        { id: "inventario", label: "Rotación" },
      ],
      steps: [
        {
          title: "Elija el período",
          detail: "Hoy, 7 días, 30 días o mes. Los indicadores y gráficas se recalculan al instante.",
          mockKey: "resumen",
        },
        {
          title: "Analice ventas por familia",
          detail: "La participación de cada familia (carnes, bebidas, almacén, limpieza…) en la facturación ayuda a decidir reabastecimiento y góndolas.",
          mockKey: "familias",
        },
        {
          title: "Revise la composición fiscal",
          detail: "Ventas gravadas 10% y 5%, y sus IVA. Distribución para la declaración.",
        },
        {
          title: "Vea la rotación de inventario",
          detail: "SKUs totales, rotación en días y los productos que rotan rápido (caro) vs lento (plata estancada).",
          mockKey: "rotacion",
        },
      ],
      mocks: {
        resumen: {
          type: "kpiGrid",
          title: "Resumen del mes",
          kpis: [
            { label: "Ventas totales", value: "₲ 4.405.900.000", sub: "mes actual", color: "green", trend: "up" },
            { label: "Tickets", value: "124.800", sub: "promedio 8,4/día por caja", color: "blue" },
            { label: "Ticket promedio", value: "₲ 35.303", sub: "+3,1% vs agosto", color: "purple", trend: "up" },
            { label: "Margen bruto", value: "24,1%", sub: "+0,8 pts vs meta", color: "amber" },
          ],
        },
        familias: {
          type: "chart",
          title: "Ventas por familia (30 días)",
          chart: {
            kind: "donut",
            points: [
              { label: "Almacén", value: 29 },
              { label: "Bebidas", value: 22 },
              { label: "Carnes", value: 18 },
              { label: "Lácteos", value: 12 },
              { label: "Limpieza", value: 9 },
              { label: "Otros", value: 10 },
            ],
          },
        },
        rotacion: {
          type: "list",
          title: "Rotación de inventario",
          items: [
            { title: "Total SKUs", sub: "4.850 · rotación promedio 22,4 días", badge: "22,4d", badgeColor: "blue" },
            { title: "Rotación rápida", sub: "Bebidas (9d) · Panadería (2d) · Lácteos (11d)", badge: "Rápido", badgeColor: "green" },
            { title: "Rotación lenta", sub: "Limpieza (52d) · Cuidado personal (48d)", badge: "Estancado", badgeColor: "amber" },
          ],
        },
      },
      tips: [
        "Combine la rotación lenta con el módulo de Benchmarking: si su precio supera al competidor, ese es el motivo.",
      ],
    },
    {
      id: "gerencial",
      label: "Reportes Gerenciales",
      path: "/gerencial",
      icon: PieChart,
      tagline: "La cuenta de resultados de gerencia",
      category: "Inteligencia & Sistema",
      color: "purple",
      description:
        "El estado de resultados para la dirección: ventas brutas, costo de mercadería, margen bruto, gastos operativos con su desglose (nómina, alquiler, energía, comisiones) y el punto de equilibrio mensual.",
      steps: [
        {
          title: "Vea la cuenta de resultados",
          detail: "La cascada completa: de la venta bruta a la utilidad neta, con cada monto y su % sobre ventas.",
          mockKey: "pyg",
        },
        {
          title: "Analice el desglose de gastos",
          detail: "Nómina, alquiler, energía y comisiones POS con su peso sobre las ventas. Detecte dónde están los mayores gastos.",
          mockKey: "opex",
        },
        {
          title: "Calcule el punto de equilibrio",
          detail: "Cuánto debe facturar el mes para cubrir todos los costos. Compare contra la venta proyectada.",
        },
      ],
      mocks: {
        pyg: {
          type: "kpiGrid",
          title: "Estado de resultados — mes",
          kpis: [
            { label: "Ventas brutas", value: "₲ 4.405.900.000", sub: "100%", color: "blue" },
            { label: "CMV", value: "₲ 3.348.484.000", sub: "76%", color: "amber" },
            { label: "Margen bruto", value: "₲ 1.057.416.000", sub: "24%", color: "green" },
            { label: "EBITDA", value: "₲ 525.556.000", sub: "11,9%", color: "purple", trend: "up" },
          ],
        },
        opex: {
          type: "table",
          title: "Desglose de gastos operativos",
          columns: [
            { label: "Concepto", value: "concepto" },
            { label: "Monto", value: "monto", currency: true },
            { label: "Peso", value: "peso", badge: true },
          ],
          rows: [
            { concepto: "Nómina", monto: 285000000, peso: "53,6%", badge: "amber" },
            { concepto: "Alquiler", monto: 95000000, peso: "17,9%", badge: "blue" },
            { concepto: "Energía ANDE", monto: 68500000, peso: "12,9%", badge: "green" },
            { concepto: "Comisiones POS", monto: 49360000, peso: "9,3%", badge: "purple" },
          ],
        },
      },
      faq: [
        { q: "¿Qué es el punto de equilibrio mensual?", a: "El nivel de ventas donde cubre costo + gastos sin perder ni ganar. Por debajo de ₲ 2.216.000.000 el mes pierde." },
      ],
    },
    {
      id: "auditoria",
      label: "Auditoría & Riesgos",
      path: "/audit",
      icon: Fingerprint,
      tagline: "Registros de auditoría y detección de riesgos",
      category: "Inteligencia & Sistema",
      color: "slate",
      description:
        "La vista de auditoría sobre los logs del sistema: quién hizo qué, cuándo y con qué nivel de riesgo. Los eventos se clasifican por categoría y se pueden analizar con el chat de riesgos.",
      steps: [
        {
          title: "Navegue el dashboard de riesgos",
          detail: "Vea el volumen de eventos por nivel (crítico, alto, medio, bajo) y las alertas de categoría: accesos, facturación, permisos.",
          mockKey: "kpis",
        },
        {
          title: "Explore los eventos",
          detail: "Filtre por nivel, categoría o usuario. Cada evento muestra fecha, detalle y quién lo generó.",
          mockKey: "eventos",
        },
      ],
      mocks: {
        kpis: {
          type: "kpiGrid",
          title: "Riesgos del sistema",
          kpis: [
            { label: "Eventos hoy", value: "148", sub: "todos los módulos", color: "blue" },
            { label: "Críticos", value: "2", sub: "requieren atención", color: "red", trend: "down" },
            { label: "Altos", value: "6", sub: "revisar", color: "amber" },
            { label: "Medios", value: "18", sub: "supervisión", color: "purple" },
          ],
        },
        eventos: {
          type: "table",
          title: "Eventos recientes",
          columns: [
            { label: "Fecha", value: "fecha" },
            { label: "Evento", value: "evento" },
            { label: "Usuario", value: "usuario" },
            { label: "Nivel", value: "nivel", badge: true },
          ],
          rows: [
            { fecha: "07/09 13:12", evento: "Cambio de precio masivo (familia Bebidas)", usuario: "Admin", nivel: "Alto", badge: "amber" },
            { fecha: "07/09 11:40", evento: "Intento de ingreso fallido ×3 (caja 2)", usuario: "nilda", nivel: "Medio", badge: "purple" },
            { fecha: "07/09 09:15", evento: "Anulación de comprobante sin permiso (bloqueada)", usuario: "carmenc", nivel: "Crítico", badge: "red" },
          ],
        },
      },
      faq: [
        { q: "¿Puedo cambiar el nivel de un evento?", a: "Los niveles se asignan por las reglas del sistema. Si cree que hay un falso positivo, comuníquese con el soporte para ajustar la regla." },
      ],
    },
    {
      id: "settings",
      label: "Configuración",
      path: "/settings",
      icon: Settings,
      tagline: "El centro de configuración del negocio",
      category: "Inteligencia & Sistema",
      color: "gray",
      description:
        "Configura todo el negocio: datos de la empresa, monedas, medios de pago, datos fiscales (RUC, timbrado), el diseñador del ticket (recibo), el modo kiosko y las cajas.",
      tabs: [
        { id: "empresa", label: "Empresa" },
        { id: "monedas", label: "Monedas" },
        { id: "pagos", label: "Pagos" },
        { id: "fiscal", label: "Fiscal" },
        { id: "ticket", label: "Diseñador de ticket" },
        { id: "kiosko", label: "Kiosko" },
        { id: "cajas", label: "Cajas" },
      ],
      steps: [
        {
          title: "Configure la empresa",
          detail: "Nombre, RUC, dirección, teléfono y logo. Estos datos salen en los comprobantes y los reportes.",
          mockKey: "empresa",
        },
        {
          title: "Defina los datos fiscales",
          detail: "RUC, punto de emisión predeterminado, timbrado y datos del autoimpresor. Clave para la validez de las facturas.",
          mockKey: "fiscal",
        },
        {
          title: "Diseñe el ticket",
          detail: "El diseñador de recibo elige qué encabezados, mensajes y pie salen impresos en cada comprobante (datos, promociones, redes).",
        },
        {
          title: "Gestione las cajas",
          detail: "Alta de cajas con su punto de emisión, impresora y gaveta.",
        },
      ],
      mocks: {
        empresa: {
          type: "form",
          title: "Datos de la empresa",
          formFields: [
            { label: "Razón social", type: "text", value: "GRUPO SANTA TERESA E.A.S." },
            { label: "RUC", type: "text", value: "80150377-9" },
            { label: "Ciudad", type: "text", value: "Pedro Juan Caballero" },
            { label: "Teléfono", type: "text", value: "(046) 242-500" },
          ],
        },
        fiscal: {
          type: "form",
          title: "Datos fiscales",
          formFields: [
            { label: "Régimen (10% / 5%)", type: "select", value: "10%", options: ["10%", "5%"] },
            { label: "Timbrado", type: "text", value: "18545636" },
            { label: "Rango emitido hasta", type: "text", value: "38.112 de 40.000" },
            { label: "Moneda de comprobantes", type: "select", value: "Guaraníes (Gs.)", options: ["Guaraníes (Gs.)", "Dólares (US$)"] },
          ],
        },
      },
      tips: [
        "Revise el diseño del ticket: un pie con el horario y la dirección del supermercado reduce consultas.",
      ],
    },
    {
      id: "branches",
      label: "Sucursales",
      path: "/branches",
      icon: Building,
      tagline: "Depósitos y puntos de operación",
      category: "Inteligencia & Sistema",
      color: "amber",
      description:
        "Administre los depósitos y sucursales: salón principal, cámara fría de carnes, depósito seco. Cada uno con sus datos, capacidad y stock asociado.",
      steps: [
        {
          title: "Consulte los depósitos",
          detail: "Cada depósito muestra su código, nombre, datos de contacto y cantidad de SKUs que alberga.",
          mockKey: "depositos",
        },
        {
          title: "Cree una sucursal nueva",
          detail: "Al abrir un nuevo local, cárguelo con sus datos y el sistema separa el stock por sucursal.",
        },
        {
          title: "Use el selector en el header",
          detail: "Desde la barra superior puede cambiar de sucursal: el contexto de stock y cajas se actualiza.",
        },
      ],
      mocks: {
        depositos: {
          type: "table",
          title: "Depósitos del negocio",
          columns: [
            { label: "Código", value: "codigo" },
            { label: "Nombre", value: "nombre" },
            { label: "Encargado", value: "encargado" },
            { label: "SKUs", value: "skus" },
          ],
          rows: [
            { codigo: "DEP-01", nombre: "Salón Principal", encargado: "Nilda Aquino", skus: 4850 },
            { codigo: "DEP-02", nombre: "Cámara Fría Carnes", encargado: "Bernardo Ríos", skus: 320 },
            { codigo: "DEP-03", nombre: "Depósito Seco", encargado: "Pedro Samaniego", skus: 1240 },
          ],
        },
      },
      faq: [
        { q: "¿Para qué sirve el selector de sucursal?", a: "Para operar en el contexto correcto: ventas, stock y cierres se asocian a la sucursal seleccionada." },
      ],
    },
    {
      id: "usuarios",
      label: "Gestión de Usuarios",
      path: "/usuarios",
      icon: Users,
      tagline: "Las personas que operan el sistema",
      category: "Inteligencia & Sistema",
      color: "blue",
      description:
        "Administre los usuarios del sistema: alta, edición, roles y estado (activo/inactivo). Cada usuario entra con su clave y opera según su rol.",
      steps: [
        {
          title: "Cree el usuario",
          detail: "Cargue nombre, usuario, contraseña y el rol (administrador, supervisor, cajero, vendedor, etiquetador).",
          mockKey: "crear",
        },
        {
          title: "Asigne el rol",
          detail: "El rol define qué puede ver y hacer. Un cajero opera POS y caja; un supervisor aprueba devoluciones y cortes.",
          mockKey: "lista",
        },
        {
          title: "Desactive el acceso",
          detail: "Al desvincular a alguien, cámbielo a inactivo: pierde el acceso al instante pero su historial queda.",
        },
      ],
      mocks: {
        crear: {
          type: "form",
          title: "Nuevo usuario",
          formFields: [
            { label: "Nombre completo", type: "text", value: "Sonia Vera Yegros", required: true },
            { label: "Usuario", type: "text", value: "sonia.v", required: true },
            { label: "Rol", type: "select", value: "Cajera", options: ["Administrador", "Supervisor", "Cajera", "Vendedor", "Etiquetador"] },
            { label: "Sucursal", type: "select", value: "Salón Principal", options: ["Salón Principal", "Cámara Fría", "Depósito Seco"] },
          ],
        },
        lista: {
          type: "table",
          title: "Usuarios del sistema",
          columns: [
            { label: "Usuario", value: "usuario" },
            { label: "Nombre", value: "nombre" },
            { label: "Rol", value: "rol", badge: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { usuario: "admin", nombre: "Administrador", rol: "Admin", estado: "Activo", badges: { rol: "red", estado: "green" } },
            { usuario: "nilda.a", nombre: "Nilda Aquino", rol: "Supervisora", estado: "Activo", badges: { rol: "amber", estado: "green" } },
            { usuario: "carmenc", nombre: "Carmen Espínola", rol: "Cajera", estado: "Activo", badges: { rol: "blue", estado: "green" } },
            { usuario: "juanc", nombre: "Juan Cantero", rol: "Cajero", estado: "Inactivo", badges: { rol: "blue", estado: "red" } },
          ],
        },
      },
      faq: [
        { q: "¿Puedo revisar qué hizo un usuario?", a: "Sí, en el módulo Auditoría & Riesgos quedan registrados los eventos de cada usuario." },
      ],
    },
    {
      id: "rbac",
      label: "Permisos & Roles (RBAC)",
      path: "/rbac",
      icon: ShieldCheck,
      tagline: "Quién puede hacer qué",
      category: "Inteligencia & Sistema",
      color: "emerald",
      description:
        "El control de acceso basado en roles: defina los roles y los permisos granulares de cada uno (ver, crear, editar, anular, aprobar) por módulo. Separa la configuración del acceso físico.",
      tabs: [
        { id: "roles", label: "Roles" },
        { id: "permisos", label: "Permisos" },
        { id: "accesos", label: "Accesos" },
      ],
      steps: [
        {
          title: "Administre los roles",
          detail: "Vea los roles existentes y sus miembros. Un rol agrupa un conjunto de permisos.",
          mockKey: "roles",
        },
        {
          title: "Ajuste los permisos granulares",
          detail: "Por módulo, marque las acciones permitidas: solo ver, o crear/editar/anular/aprobar según el rol.",
          mockKey: "permisos",
        },
        {
          title: "Asigne usuarios a roles",
          detail: "En la pestaña de accesos, vincule cada usuario a su rol y revise las asignaciones vigentes.",
        },
      ],
      mocks: {
        roles: {
          type: "table",
          title: "Roles del sistema",
          columns: [
            { label: "Rol", value: "rol" },
            { label: "Descripción", value: "desc" },
            { label: "Usuarios", value: "usuarios" },
          ],
          rows: [
            { rol: "Administrador", desc: "Acceso total a todos los módulos", usuarios: 1 },
            { rol: "Supervisor", desc: "Cajas, devoluciones, arqueos, cortes", usuarios: 2 },
            { rol: "Cajera", desc: "POS y caja, sin anulaciones", usuarios: 14 },
            { rol: "Vendedor", desc: "Pedidos, cotizaciones, clientes", usuarios: 6 },
          ],
        },
        permisos: {
          type: "form",
          title: "Permisos del rol Cajera",
          formFields: [
            { label: "Punto de Venta — vender", type: "select", value: "Habilitado", options: ["Habilitado", "Solo ver", "Denegado"] },
            { label: "Facturación — anular", type: "select", value: "Denegado", options: ["Habilitado", "Solo ver", "Denegado"] },
            { label: "Devoluciones — crear", type: "select", value: "Denegado", options: ["Habilitado", "Solo ver", "Denegado"] },
            { label: "Clientes — editar", type: "select", value: "Solo ver", options: ["Habilitado", "Solo ver", "Denegado"] },
          ],
        },
      },
      faq: [
        { q: "¿Un cajero puede anular un comprobante?", a: "No, la anulación requiere el rol de supervisor o administrador. Este control lo define el RBAC." },
      ],
    },
  ],
}