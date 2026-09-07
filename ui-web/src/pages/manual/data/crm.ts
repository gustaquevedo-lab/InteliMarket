import { Users, Ticket, PieChart, Tag } from "lucide-react"
import type { ManualCategory } from "../types"

export const crmCategory: ManualCategory = {
  id: "crm",
  label: "CRM & Marketing",
  icon: Users,
  gradient: "from-pink-600 to-fuchsia-700",
  description: "Conozca y haga crecer su clientela: el programa de fidelidad ExtraClub, los cupones de sorteo, la vista 360 de cada cliente y las promociones.",
  subtitle: "Fidelidad, cupones y conocimiento del cliente",
  modules: [
    {
      id: "crm",
      label: "Fidelidad ExtraClub",
      path: "/crm",
      icon: Users,
      tagline: "Puntos, categorías y recompensas",
      category: "CRM & Marketing",
      color: "pink",
      description:
        "El programa de lealtad del supermercado: los clientes acumulan puntos con cada compra (según una regla configurable), suben de categoría (VIP, Oro, Plata, Bronce) y canjean premios. Incluye la solicitud de membresía y la segmentación RFM.",
      tabs: [
        { id: "miembros", label: "Miembros" },
        { id: "solicitudes", label: "Solicitudes" },
        { id: "rfm", label: "RFM" },
        { id: "premios", label: "Premios" },
        { id: "reglas", label: "Reglas" },
      ],
      steps: [
        {
          title: "Inscriba socios",
          detail: "Un cliente se inscribe en ExtraClub (en caja o desde su cuenta). La solicitud se aprueba y el socio empieza a acumular desde su próxima compra.",
          mockKey: "socios",
        },
        {
          title: "Configure la regla de puntos",
          detail: "Defina cuántos puntos por cada 1.000 ₲ de compra y la jerarquía de categorías: VIP (mayor acumulación), Oro, Plata, Bronce.",
        },
        {
          title: "Vea la segmentación RFM",
          detail: "El análisis RFM (recencia, frecuencia, monto) clasifica a los socios: clientes top, en riesgo, nuevos, dormidos. Base para las campañas.",
          mockKey: "rfm",
        },
        {
          title: "Administre premios",
          detail: "Defina los premios canjeables (descuento, producto gratis) y su costo en puntos. El canje se hace en caja.",
          mockKey: "premios",
        },
      ],
      mocks: {
        socios: {
          type: "table",
          title: "Socios ExtraClub",
          columns: [
            { label: "Cliente", value: "cliente" },
            { label: "Categoría", value: "categoria", badge: true },
            { label: "Puntos", value: "puntos" },
            { label: "Compras", value: "compras", currency: true },
          ],
          rows: [
            { cliente: "María L. Benítez", categoria: "VIP", badge: "purple", puntos: 48250, compras: 12800000 },
            { cliente: "Pedro Ruiz", categoria: "Oro", badge: "amber", puntos: 21400, compras: 6850000 },
            { cliente: "Ana Benítez", categoria: "Plata", badge: "blue", puntos: 9800, compras: 3420000 },
            { cliente: "Carlos Giménez", categoria: "Bronce", badge: "gray", puntos: 3200, compras: 1050000 },
          ],
        },
        rfm: {
          type: "chart",
          title: "Distribución RFM de socios",
          chart: {
            kind: "donut",
            points: [
              { label: "Campeones", value: 180 },
              { label: "Fieles", value: 250 },
              { label: "En riesgo", value: 95 },
              { label: "Dormidos", value: 130 },
              { label: "Nuevos", value: 62 },
            ],
          },
        },
        premios: {
          type: "list",
          title: "Premios activos",
          items: [
            { title: "Bolsa sorpresa — 25.000 puntos", sub: "Surtido de ₲ 150.000 · 32 canjes este mes", badge: "Popular", badgeColor: "green" },
            { title: "Descuento 10% — 8.000 puntos", sub: "En compra mayor a ₲ 300.000 · 118 canjes", badge: "Activo", badgeColor: "blue" },
            { title: "Producto gratis — 5.000 puntos", sub: "Coca-Cola 2.25L · 210 canjes", badge: "Activo", badgeColor: "purple" },
          ],
        },
      },
      tips: [
        "Los puntos no canjeados generan obligación contable: concilie el pasivo de puntos cada mes.",
      ],
    },
    {
      id: "cupones",
      label: "Cupones de Sorteo",
      path: "/cupones",
      icon: Ticket,
      tagline: "Cupones, sorteos y captura de datos",
      category: "CRM & Marketing",
      color: "rose",
      description:
        "El sistema de cupones que impulsa la captura de datos de clientes: por cada monto comprado se entregan cupones para un gran sorteo. Configure el trigger (monto global, productos específicos, marca o categoría), los umbrales y los barrios participantes.",
      steps: [
        {
          title: "Configure la campaña",
          detail: "Defina el disparador: monto global de compra, productos específicos, una marca o una categoría. Fije cuántos cupones se entregan por umbral (ej: 1 cupón cada ₲ 200.000).",
          mockKey: "campana",
        },
        {
          title: "Capture al cliente",
          detail: "El cupón se vincula al cliente registrado (nombre, CI, teléfono, barrio). Es la base para el sorteo y para campañas futuras.",
        },
        {
          title: "Gestione el sorteo",
          detail: "Consulte los cupones emitidos, filtre por barrio/campaña y realice el sorteo con transparencia.",
          mockKey: "sorteo",
        },
      ],
      mocks: {
        campana: {
          type: "form",
          title: "Campaña de sorteo",
          formFields: [
            { label: "Nombre", type: "text", value: "Gran Premio Don Julio 2026", required: true },
            { label: "Trigger", type: "select", value: "Monto global", options: ["Monto global", "Productos específicos", "Marca del proveedor", "Categoría"] },
            { label: "Valor umbral", type: "number", value: "₲ 200.000" },
            { label: "Cupones por umbral", type: "number", value: "1" },
          ],
        },
        sorteo: {
          type: "table",
          title: "Cupones emitidos",
          columns: [
            { label: "Nº cupón", value: "numero" },
            { label: "Cliente", value: "cliente" },
            { label: "Barrio", value: "barrio" },
            { label: "Compra", value: "compra", currency: true },
            { label: "Estado", value: "estado", badge: true },
          ],
          rows: [
            { numero: "CP-000142", cliente: "Jorge Vera", barrio: "Centro", compra: 452000, estado: "Participa", badge: "green" },
            { numero: "CP-000143", cliente: "Sonia Cantero", barrio: "Loma San Julián", compra: 230000, estado: "Participa", badge: "green" },
            { numero: "CP-000144", cliente: "Raúl Díaz", barrio: "Ponta Porã", compra: 610000, estado: "Ganador", badge: "purple" },
          ],
        },
      },
      faq: [
        { q: "¿Se puede participar con cupones acumulados?", a: "Sí, cada umbral suma un cupón. El sistema registra todos los cupones del cliente en la campaña." },
      ],
    },
    {
      id: "customer360",
      label: "Customer 360",
      path: "/customer360",
      icon: PieChart,
      tagline: "El cliente completo, en una sola vista",
      category: "CRM & Marketing",
      color: "cyan",
      description:
        "La vista integral de cada cliente: perfil, historial de compras, la canasta habitual, el scoring RFM y las campañas de retención. Centraliza todo lo que el sistema sabe del cliente.",
      steps: [
        {
          title: "Abra el perfil del cliente",
          detail: "Consulte los KPIs: total de tickets, gasto acumulado, ticket promedio y la antigüedad como cliente.",
          mockKey: "perfil",
        },
        {
          title: "Analice la canasta habitual",
          detail: "Qué productos compra con frecuencia y en qué proporción. Útil para cross-selling y para reponer antes de que venga.",
          mockKey: "canasta",
        },
        {
          title: "Actúe con las campañas de retención",
          detail: "Si el cliente está en riesgo, el módulo sugiere la campaña de retención adecuada (cupón, descuento, contacto).",
        },
      ],
      mocks: {
        perfil: {
          type: "kpiGrid",
          title: "Perfil — María L. Benítez",
          kpis: [
            { label: "Tickets", value: "342", sub: "últimos 12 meses", color: "blue" },
            { label: "Gasto total", value: "₲ 12.800.000", sub: "año corrido", color: "green" },
            { label: "Ticket promedio", value: "₲ 37.400", sub: "30 días", color: "purple" },
            { label: "RFM", value: "Campeón", sub: "riesgo: bajo", color: "amber" },
          ],
        },
        canasta: {
          type: "list",
          title: "Canasta habitual",
          items: [
            { title: "Coca-Cola 2.25L", sub: "cada 2,1 días · 96% de las visitas", badge: "Frecuente", badgeColor: "green" },
            { title: "Leche larga vida 1L", sub: "cada 3,4 días · 78% de las visitas", badge: "Frecuente", badgeColor: "green" },
            { title: "Pan francés (docena)", sub: "cada 4,0 días · 64% de las visitas", badge: "Habitual", badgeColor: "blue" },
          ],
        },
      },
      tips: [
        "Use el 360 antes de atender un reclamo: el historial completo ayuda a resolver mejor y más rápido.",
      ],
    },
    {
      id: "promociones",
      label: "Promociones & Campañas",
      path: "/promociones",
      icon: Tag,
      tagline: "Descuentos del origen al precio",
      category: "CRM & Marketing",
      color: "fuchsia",
      description:
        "Centraliza todas las promociones del negocio: de corto vencimiento (marcar producto próximo a vencer), de acción del proveedor (costo subvencionado) o iniciativa propia. Cada promo tiene origen, vigencia y precio resultante.",
      steps: [
        {
          title: "Cree la promoción",
          detail: "Defina producto(s), tipo de descuento (porcentaje, monto, 2x1), vigencia y el origen: corto vencimiento, proveedor o propia.",
          mockKey: "crear",
        },
        {
          title: "Revise el efecto en precio",
          detail: "El sistema calcula el precio con descuento. Los productos en promo se etiquetan en góndola, POS y tienda online.",
          mockKey: "vigentes",
        },
        {
          title: "Mida el resultado",
          detail: "Compare el volumen vendido durante la promo contra el período anterior para evaluar la efectividad.",
        },
      ],
      mocks: {
        crear: {
          type: "form",
          title: "Nueva promoción",
          formFields: [
            { label: "Nombre", type: "text", value: "Sábado de Carnicería", required: true },
            { label: "Producto(s)", type: "text", value: "Vacío, Costilla, Milanesa" },
            { label: "Tipo", type: "select", value: "Descuento %", options: ["Descuento %", "Descuento monto", "2x1"] },
            { label: "Descuento", type: "number", value: "15%" },
            { label: "Vigencia", type: "text", value: "12/09/2026 – 13/09/2026" },
          ],
        },
        vigentes: {
          type: "list",
          title: "Promociones vigentes",
          items: [
            { title: "Sábado de Carnicería −15%", sub: "Vacío ₲ 58.650/kg · Costilla ₲ 45.900 · Milanesa ₲ 61.200", badge: "Propia", badgeColor: "green" },
            { title: "Líquidos Paresa −8%", sub: "Costo subvencionado por proveedor · vigente 7 días", badge: "Proveedor", badgeColor: "blue" },
            { title: "Lácteos corto vencimiento −30%", sub: "180 unidades · marca y drena", badge: "Corto venc.", badgeColor: "amber" },
          ],
        },
      },
      faq: [
        { q: "¿Las promos aplican en la tienda online?", a: "Sí, si se publican al canal web. En POS aplican automáticamente al carrito según las condiciones." },
      ],
    },
  ],
}